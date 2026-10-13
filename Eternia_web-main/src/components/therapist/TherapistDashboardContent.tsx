import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Users, Headphones, History, User, Phone, Loader2, AlertTriangle, Clock, Flag, Send, Shield, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createVideoSDKRoom, getVideoSDKToken } from "@/lib/videosdk";

const MeetingProvider = lazy(() => import("@videosdk.live/react-sdk").then(m => ({ default: m.MeetingProvider })));
const MeetingView = lazy(() => import("@/components/videosdk/MeetingView"));
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "queue" | "session" | "history" | "profile";

interface QueueItem {
  id: string;
  student_id: string;
  status: string;
  flag_level: number;
  created_at: string;
  student_username?: string;
}

interface EscalationRecord {
  id: string;
  flag_level: number;
  escalation_reason: string | null;
  escalation_history: any[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  session_notes_encrypted: string | null;
}

const TherapistDashboardContent = ({ isMobile }: { isMobile?: boolean }) => {
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  // Active session state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionNotes, setSessionNotes] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  // Escalation dialog
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [escalationLevel, setEscalationLevel] = useState("1");
  const [escalationReason, setEscalationReason] = useState("");

  // History
  const [history, setHistory] = useState<EscalationRecord[]>([]);

  // Ref to hold the VideoSDK leave function for programmatic disconnect
  const leaveCallRef = useRef<(() => void) | null>(null);
  const captureSnippetRef = useRef<(() => Promise<string>) | null>(null);

  // Stay/Leave dialog when expert joins an escalated session
  const [expertJoinedDialog, setExpertJoinedDialog] = useState(false);

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from("blackbox_sessions")
      .select("id, student_id, status, flag_level, created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      // Fetch student usernames
      const studentIds = data.map((d: any) => d.student_id);
      let profiles: any[] = [];
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", studentIds);
        profiles = profilesData || [];
      }

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.username]));
      setQueue(
        data.map((d: any) => ({
          ...d,
          student_username: profileMap.get(d.student_id) || "Anonymous",
        }))
      );
    }
    setIsLoadingQueue(false);
  }, []);

  // Realtime queue subscription
  useEffect(() => {
    fetchQueue();
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`therapist-queue-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "blackbox_sessions" }, () => {
        fetchQueue();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchQueue]);

  // Realtime listener: detect when an expert joins our active escalated session
  useEffect(() => {
    if (!user || !activeSession) return;
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`therapist-expert-join-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "blackbox_sessions",
          filter: `id=eq.${activeSession.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          // Detect expert joining via escalation_history growing
          const prevHistory = activeSession.escalation_history || [];
          const newHistory = updated.escalation_history || [];
          if (newHistory.length > prevHistory.length) {
            const lastEntry = newHistory[newHistory.length - 1];
            if (lastEntry?.type === "expert_joined") {
              setExpertJoinedDialog(true);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeSession]);

  // Check for existing active session
  useEffect(() => {
    if (!user) return;
    const checkActive = async () => {
      const { data } = await supabase
        .from("blackbox_sessions")
        .select("id, student_id, therapist_id, status, flag_level, room_id, escalation_history, escalation_reason, session_notes_encrypted, started_at, ended_at, created_at")
        .eq("therapist_id", user.id)
        .in("status", ["accepted", "active"])
        .limit(1);

      if (data && data.length > 0) {
        setActiveSession(data[0]);
        setActiveTab("session");
        if ((data[0] as any).room_id) {
          try {
            const t = await getVideoSDKToken();
            setToken(t);
          } catch (error: any) {
            toast.error(error.message || "Failed to reconnect to audio session");
          }
        }
      }
    };
    checkActive();
  }, [user]);

  // Session timer
  useEffect(() => {
    if (!activeSession?.started_at) return;
    const start = new Date(activeSession.started_at).getTime();
    const interval = setInterval(() => {
      setSessionTimer(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.started_at]);

  // Fetch history
  useEffect(() => {
    if (activeTab !== "history" || !user) return;
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("blackbox_sessions")
        .select("id, flag_level, escalation_reason, escalation_history, started_at, ended_at, created_at, session_notes_encrypted")
        .eq("therapist_id", user.id)
        .in("status", ["completed", "escalated"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setHistory(data as unknown as EscalationRecord[]);
    };
    fetchHistory();
  }, [activeTab, user]);

  // Accept session from queue
  const acceptSession = async (sessionId: string) => {
    if (!user) return;
    setIsAccepting(true);
    try {
      const { token: t, roomId } = await createVideoSDKRoom();

      // Set status to "accepted" first (not "active") — active only after both join
      const { data: updated, error } = await supabase
        .from("blackbox_sessions")
        .update({
          therapist_id: user.id,
          status: "accepted",
          room_id: roomId,
          started_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("status", "queued")
        .select("id, student_id, therapist_id, status, flag_level, room_id, escalation_history, escalation_reason, session_notes_encrypted, started_at, ended_at, created_at")
        .single();

      if (error) throw error;
      if (!updated) throw new Error("Session was already claimed by another therapist");

      setToken(t);
      setActiveSession(updated);
      setActiveTab("session");
      toast.success("Session accepted — waiting for student to join…");
    } catch (err: any) {
      toast.error(err.message || "Failed to accept session");
    } finally {
      setIsAccepting(false);
    }
  };

  // End session
  const endSession = async () => {
    if (!activeSession) return;
    await supabase
      .from("blackbox_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        session_notes_encrypted: sessionNotes || null,
      })
      .eq("id", activeSession.id);

    setActiveSession(null);
    setToken(null);
    setSessionNotes("");
    setSessionTimer(0);
    setActiveTab("queue");
    toast.success("Session completed");
  };

  // Submit escalation
  const submitEscalation = async () => {
    if (!activeSession || !escalationReason.trim()) return;
    const level = parseInt(escalationLevel);
    const historyEntry = {
      level,
      reason: escalationReason,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...(activeSession.escalation_history || []), historyEntry];

    await supabase
      .from("blackbox_sessions")
      .update({
        flag_level: level,
        escalation_reason: escalationReason,
        escalation_history: updatedHistory,
        // For L3, status will be updated again below after expert lookup; for L1-L2 keep active
        status: "active",
      })
      .eq("id", activeSession.id);

    // Route ALL escalation levels through edge function for structured data
    let snippet: string | null = null;
    if (captureSnippetRef?.current) {
      toast.info("Capturing transcript (±10s)...");
      snippet = await captureSnippetRef.current();
    }

    const { data: escData, error: escError } = await supabase.functions.invoke("escalate-emergency", {
      body: {
        session_id: activeSession.id,
        justification: escalationReason,
        transcript_snippet: snippet || null,
      },
    });

    if (escError) {
      toast.error(escError.message || "Escalation failed");
    } else if (escData?.error) {
      toast.error(escData.error);
    }

    // §14.2: Audit log for escalation
    if (user) {
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action_type: "escalation_submitted",
        target_table: "blackbox_sessions",
        target_id: activeSession.id,
        metadata: { level, reason_length: escalationReason.length },
      });
    }

    if (level >= 3) {
      // Therapist stays in session — do NOT leave
      setActiveSession({ ...activeSession, flag_level: level, escalation_history: updatedHistory, status: "escalated" });
      toast.warning("Experts have been notified — they will join your session");
    } else {
      setActiveSession({ ...activeSession, flag_level: level, escalation_history: updatedHistory });
      toast.info(`Escalation level ${level} recorded`);
    }

    setEscalationOpen(false);
    setEscalationReason("");
    setEscalationLevel("1");
  };

  // Save notes
  const saveNotes = async () => {
    if (!activeSession) return;
    await supabase
      .from("blackbox_sessions")
      .update({ session_notes_encrypted: sessionNotes })
      .eq("id", activeSession.id);
    toast.success("Notes saved");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const flagColors: Record<number, string> = {
    0: "bg-muted text-muted-foreground",
    1: "bg-yellow-500/20 text-yellow-400",
    2: "bg-orange-500/20 text-orange-400",
    3: "bg-destructive/20 text-destructive",
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "queue", label: "Queue", icon: Users },
    { id: "session", label: "Session", icon: Headphones },
    { id: "history", label: "History", icon: History },
    { id: "profile", label: "Profile", icon: User },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24 lg:pb-0">
      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold font-display">Session Queue</h1>
            <p className="text-sm text-muted-foreground">Students waiting for support</p>
          </div>

          {activeSession && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-sm font-medium">You have an active session.</p>
              <Button size="sm" className="mt-2" onClick={() => setActiveTab("session")}>
                Go to Session
              </Button>
            </div>
          )}

          {isLoadingQueue ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No students in queue</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.student_username}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting {getTimeSince(item.created_at)}
                        </span>
                        {item.flag_level > 0 && (
                          <Badge className={`text-[10px] ${flagColors[item.flag_level]}`}>
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            L{item.flag_level}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={isAccepting || !!activeSession}
                    onClick={() => acceptSession(item.id)}
                    className="shrink-0"
                  >
                    {isAccepting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Phone className="w-4 h-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Session Tab */}
      {activeTab === "session" && (
        <div className="space-y-4">
          {!activeSession ? (
            <div className="text-center py-12 text-muted-foreground">
              <Headphones className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No active session</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("queue")}>
                Go to Queue
              </Button>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold font-display">Active Session</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-mono text-primary">{formatTime(sessionTimer)}</span>
                    <Badge className={flagColors[activeSession.flag_level || 0]}>
                      <Flag className="w-3 h-3 mr-1" />
                      Level {activeSession.flag_level || 0}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEscalationOpen(true)}
                    className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Escalate
                  </Button>
                  <Button variant="destructive" size="sm" onClick={endSession}>
                    End Call
                  </Button>
                </div>
              </div>

              {/* Audio session */}
              {token && activeSession.room_id ? (
                <Suspense fallback={<div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-sm">Loading call...</p></div>}>
                <div className="rounded-xl bg-card border border-border overflow-hidden"
                  key={`${activeSession.id}-${activeSession.room_id}`}
                >
                 <MeetingProvider
                    config={{
                      meetingId: activeSession.room_id,
                      micEnabled: true,
                      webcamEnabled: false,
                      name: profile?.username || "Therapist",
                      participantId: profile?.id || user?.id,
                      debugMode: false,
                    }}
                    token={token}
                    joinWithoutUserInteraction={false}
                  >
                    <MeetingView
                      meetingId={activeSession.room_id}
                      onMeetingLeave={endSession}
                      audioOnly={true}
                      sessionId={activeSession.id}
                      enableMonitoring={true}
                      autoJoin={true}
                      isTherapistView={true}
                      onLeaveReady={(leaveFn) => { leaveCallRef.current = leaveFn; }}
                      onJoined={async () => {
                        await supabase.from("blackbox_sessions")
                          .update({ therapist_joined_at: new Date().toISOString() } as any)
                          .eq("id", activeSession.id);
                      }}
                      onRiskDetected={(level, snippet) => {
                        if (level >= 2) {
                          toast.warning(`AI detected risk level ${level}`, {
                            description: "Review and consider escalating.",
                          });
                        }
                      }}
                      onEscalateFromSuggestion={(snippet, riskLevel) => {
                        setEscalationLevel(String(riskLevel));
                        setEscalationReason(snippet || "AI-detected risk during session");
                        setEscalationOpen(true);
                      }}
                      onCaptureSnippetReady={(fn) => { captureSnippetRef.current = fn; }}
                      onEscalate={() => setEscalationOpen(true)}
                    />
                  </MeetingProvider>
                </div>
                </Suspense>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Connecting to audio...</p>
                </div>
              )}

              {/* Session notes */}
              <div className="p-4 rounded-xl bg-card border border-border">
                <h3 className="text-sm font-semibold mb-2">Session Notes</h3>
                <Textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Record session observations..."
                  className="min-h-[100px] bg-muted/30 resize-none text-sm mb-2"
                />
                <Button size="sm" variant="outline" onClick={saveNotes}>
                  <Send className="w-3.5 h-3.5 mr-1" />Save Notes
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Escalation History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold font-display">Escalation History</h1>
            <p className="text-sm text-muted-foreground">Past escalated and completed sessions</p>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={flagColors[h.flag_level]}>
                        <Flag className="w-3 h-3 mr-0.5" />L{h.flag_level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {h.started_at && h.ended_at && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round((new Date(h.ended_at).getTime() - new Date(h.started_at).getTime()) / 60000)}min
                      </span>
                    )}
                  </div>
                  {h.escalation_reason && (
                    <p className="text-sm text-foreground/80 mb-1">{h.escalation_reason}</p>
                  )}
                  {h.session_notes_encrypted && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Notes: {h.session_notes_encrypted}</p>
                  )}
                  {h.escalation_history && (h.escalation_history as any[]).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(h.escalation_history as any[]).map((eh: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          L{eh.level}: {eh.reason} — {new Date(eh.timestamp).toLocaleTimeString()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold font-display">Profile</h1>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{profile?.username || "Therapist"}</h2>
                <p className="text-sm text-muted-foreground capitalize">{profile?.role || "expert"}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {profile?.is_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
            {profile?.specialty && (
              <p className="text-sm text-muted-foreground mb-2">Specialty: {profile.specialty}</p>
            )}
            <p className="text-sm text-muted-foreground">Sessions: {profile?.total_sessions || 0}</p>
          </div>
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />Logout
          </Button>
        </div>
      )}

      {/* Stay / Leave Dialog — shown when expert joins escalated session */}
      <Dialog open={expertJoinedDialog} onOpenChange={setExpertJoinedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Expert Has Joined Your Session
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            An expert has joined this session to assist. You may stay to provide support or leave the session — the expert will take over.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpertJoinedDialog(false)}>
              Stay in Session
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setExpertJoinedDialog(false);
                if (leaveCallRef.current) {
                  try { leaveCallRef.current(); } catch {}
                  leaveCallRef.current = null;
                }
                setActiveSession(null);
                setToken(null);
                setActiveTab("queue");
                toast.info("You have left the session — expert is now leading");
              }}
            >
              <LogOut className="w-4 h-4 mr-1" />
              Leave Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation Dialog */}
      <Dialog open={escalationOpen} onOpenChange={setEscalationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Escalate Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Escalation Level</label>
              <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 — Flag & Monitor</SelectItem>
                  <SelectItem value="2">Level 2 — Alert SPOC (no identity)</SelectItem>
                  <SelectItem value="3">Level 3 — Critical: Transfer to Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reason</label>
              <Textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Describe the reason for escalation..."
                className="min-h-[80px] resize-none"
              />
            </div>
            {escalationLevel === "3" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                This will notify all experts to join your session. You will stay connected.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalationOpen(false)}>Cancel</Button>
            <Button onClick={submitEscalation} disabled={!escalationReason.trim()} className="bg-orange-500 hover:bg-orange-600">
              Submit Escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistDashboardContent;
