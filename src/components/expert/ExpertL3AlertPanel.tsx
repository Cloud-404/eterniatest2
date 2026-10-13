import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Phone, PhoneCall, Loader2, Shield, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import VideoCallModal from "@/components/videosdk/VideoCallModal";


interface L3Session {
  id: string;
  student_id: string;
  therapist_id: string | null;
  flag_level: number;
  escalation_reason: string | null;
  escalation_history: any | null;
  room_id: string | null;
  status: string;
  created_at: string;
}

const ExpertL3AlertPanel = () => {
  const { user, profile } = useAuth();
  const [l3Sessions, setL3Sessions] = useState<L3Session[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [callModal, setCallModal] = useState<{ open: boolean }>({ open: false });
  const [activeSession, setActiveSession] = useState<L3Session | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);

  const captureSnippetRef = useRef<(() => Promise<string>) | null>(null);

  const handleCaptureSnippetReady = useCallback((captureFn: () => Promise<string>) => {
    captureSnippetRef.current = captureFn;
  }, []);

  const handleRiskDetected = useCallback((level: number, snippet: string) => {
    if (level >= 2) {
      toast.warning(`⚠️ AI detected risk level L${level} during session`, { duration: 8000 });
    }
  }, []);

  // Fetch active L3 sessions
  useEffect(() => {
    if (!user) return;

    const fetchL3 = async () => {
      const { data } = await supabase
        .from("blackbox_sessions")
        .select("id, student_id, therapist_id, flag_level, escalation_reason, escalation_history, room_id, status, created_at")
        .gte("flag_level", 3)
        .in("status", ["active", "accepted", "queued", "escalated"])
        .neq("status", "completed")
        .order("created_at", { ascending: false });
      if (data) setL3Sessions(data);
    };

    fetchL3();

    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`expert-l3-alerts-${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blackbox_sessions" },
        (payload) => {
          const session = (payload.new as any);
          if (session && session.flag_level >= 3 && ["active", "accepted", "queued", "escalated"].includes(session.status)) {
            setL3Sessions((prev) => {
              const exists = prev.find((s) => s.id === session.id);
              if (exists) return prev.map((s) => (s.id === session.id ? session : s));
              toast.error("🚨 CRITICAL: High-risk BlackBox session detected!", { duration: 10000 });
              return [session, ...prev];
            });
          } else if (session) {
            setL3Sessions((prev) => prev.filter((s) => s.id !== session.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Helper to check claim status from escalation_history
  const getClaimStatus = (session: L3Session) => {
    let history: any[] = [];
    try {
      const raw = session.escalation_history;
      if (Array.isArray(raw)) {
        history = raw;
      } else if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        history = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      history = [];
    }
    const claimEntry = history.find(
      (entry: any) => entry && typeof entry === "object" && entry.type === "expert_claimed" && typeof entry.expert_id === "string"
    );
    if (!claimEntry) return { claimed: false, byMe: false, byOther: false };
    return {
      claimed: true,
      byMe: claimEntry.expert_id === user?.id,
      byOther: claimEntry.expert_id !== user?.id,
    };
  };

  const handleJoinCall = async (session: L3Session) => {
    if (!user) return;
    setJoining(session.id);
    try {
      const roomId = session.room_id;
      if (!roomId) {
        toast.error("No room available for this session");
        setJoining(null);
        return;
      }

      // Open call modal first, claim happens after join succeeds
      setActiveSession(session);
      setCallModal({ open: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to join session");
    }
    setJoining(null);
  };

  // Called after the expert's call successfully joins
  const handleCallJoined = useCallback(async () => {
    if (!user || !activeSession) return;
    try {
      // Atomic claim via backend
      const { data, error } = await supabase.functions.invoke("claim-l3-session", {
        body: { session_id: activeSession.id },
      });

      if (error) {
        const msg = error.message || "Claim failed";
        if (msg.includes("already claimed")) {
          toast.error("Session already claimed by another expert. Leaving...");
          setCallModal({ open: false });
          return;
        }
        throw new Error(msg);
      }

      if (data?.error) {
        if (data.error.includes("already claimed")) {
          toast.error("Session already claimed by another expert. Leaving...");
          setCallModal({ open: false });
          return;
        }
        throw new Error(data.error);
      }

      toast.success("Session claimed — you are now the lead expert");
    } catch (err: any) {
      toast.error(err.message || "Failed to claim session");
      setCallModal({ open: false });
    }
  }, [user, activeSession]);

  const handleEmergencyEscalation = async () => {
    if (!user || !activeSession) return;
    setEscalating(true);
    try {
      let transcriptSnippet = "";
      if (captureSnippetRef.current) {
        toast.info("Capturing transcript (±10s)...");
        transcriptSnippet = await captureSnippetRef.current();
      }

      const { data, error } = await supabase.functions.invoke("escalate-emergency", {
        body: {
          session_id: activeSession.id,
          justification: `L3 Emergency escalation by expert during BlackBox session. ${activeSession.escalation_reason || "Critical risk detected by AI."}`,
          transcript_snippet: transcriptSnippet || null,
        },
      });

      if (error) throw new Error(error.message || "Escalation failed");
      if (data?.error) throw new Error(data.error);

      toast.success("Emergency contact shared with SPOC dashboard");
      setShowEscalateConfirm(false);
    } catch (err: any) {
      toast.error(err.message || "Escalation failed");
    }
    setEscalating(false);
  };

  if (l3Sessions.length === 0) return null;

  return (
    <>
      {/* Emergency Alert Banner */}
      <div className="space-y-3">
        {l3Sessions.map((session) => {
          const claim = getClaimStatus(session);
          const isActiveByMe = activeSession?.id === session.id || claim.byMe;
          
          return (
            <div
              key={session.id}
              className="p-4 rounded-xl border-2 border-destructive/50 bg-destructive/10 animate-pulse-slow"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm text-destructive">🚨 L3 Critical — Emergency Session</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
                      L{session.flag_level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {session.escalation_reason || "High-risk content detected by AI safety system"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(session.created_at), "MMM d · h:mm a")} · Room: {session.room_id || "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {isActiveByMe ? (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => {
                            setActiveSession(session);
                            setCallModal({ open: true });
                          }}
                        >
                          <Video className="w-3.5 h-3.5" />
                          Rejoin Call
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => {
                            setActiveSession(session);
                            setShowEscalateConfirm(true);
                          }}
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          Escalate — Share Emergency Contact
                        </Button>
                      </>
                    ) : claim.byOther ? (
                      <span className="text-xs text-muted-foreground italic">Claimed by another expert</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => handleJoinCall(session)}
                        disabled={joining === session.id}
                      >
                        {joining === session.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Shield className="w-3.5 h-3.5" />
                        )}
                        Join Call
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Emergency Escalation Confirmation Dialog */}
      <Dialog open={showEscalateConfirm} onOpenChange={setShowEscalateConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <PhoneCall className="w-5 h-5" />
              Emergency Escalation
            </DialogTitle>
            <DialogDescription>
              This will fetch the student's emergency contact and share it with the SPOC dashboard. This action is audited and irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-muted-foreground">
            <p className="font-medium text-destructive mb-1">⚠️ Final escalation step</p>
            <p>The student's emergency contact information will be revealed to the institution SPOC for immediate intervention.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEscalateConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={escalating}
              onClick={handleEmergencyEscalation}
              className="gap-1.5"
            >
              {escalating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
              Confirm Escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Call Modal — with AI monitoring enabled, auto-start when room is ready */}
      <VideoCallModal
        isOpen={callModal.open}
        onClose={() => {
          setCallModal({ open: false });
          captureSnippetRef.current = null;
        }}
        participantName={profile?.username || "Expert"}
        mode="video"
        existingRoomId={activeSession?.room_id || undefined}
        sessionId={activeSession?.id}
        sessionType="blackbox"
        enableMonitoring={true}
        isTherapistView={true}
        onRiskDetected={handleRiskDetected}
        onCaptureSnippetReady={handleCaptureSnippetReady}
        autoStart={true}
        onCallJoined={handleCallJoined}
      />
    </>
  );
};

export default ExpertL3AlertPanel;
