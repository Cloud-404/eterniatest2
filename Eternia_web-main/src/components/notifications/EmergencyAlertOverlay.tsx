import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Eye, ShieldAlert, User, Clock } from "lucide-react";
import { format } from "date-fns";

interface EmergencyAlert {
  id: string;
  justification_encrypted: string;
  trigger_snippet: string | null;
  created_at: string;
  escalation_level: number | null;
  status: string;
  session_id: string | null;
}

interface EmergencyAlertOverlayProps {
  onViewFlags?: () => void;
}

const EmergencyAlertOverlay = ({ onViewFlags }: EmergencyAlertOverlayProps) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("acknowledged_emergency_alerts");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const alarmRef = useRef<{ stop: () => void } | null>(null);

  const playAlarmSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let stopped = false;

      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Urgent alternating alarm pattern
      const now = audioCtx.currentTime;
      for (let i = 0; i < 6; i++) {
        if (stopped) break;
        playTone(880, now + i * 0.4, 0.2);
        playTone(660, now + i * 0.4 + 0.2, 0.2);
      }

      return {
        stop: () => {
          stopped = true;
          audioCtx.close();
        },
      };
    } catch {
      return { stop: () => {} };
    }
  }, []);

  // Subscribe to critical escalation_requests in realtime
  useEffect(() => {
    if (!user) return;

    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`emergency-alerts-overlay-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escalation_requests" },
        (payload) => {
          const row = payload.new as any;
          // Only show for critical/high-level escalations (level >= 3 or status critical)
          if (row.status === "critical" || (row.escalation_level && row.escalation_level >= 3)) {
            const alert: EmergencyAlert = {
              id: row.id,
              justification_encrypted: row.justification_encrypted,
              trigger_snippet: row.trigger_snippet,
              created_at: row.created_at,
              escalation_level: row.escalation_level,
              status: row.status,
              session_id: row.session_id,
            };

            setAlerts((prev) => {
              if (prev.some((a) => a.id === alert.id)) return prev;
              return [alert, ...prev];
            });

            // Play alarm
            alarmRef.current?.stop();
            alarmRef.current = playAlarmSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      alarmRef.current?.stop();
    };
  }, [user, playAlarmSound]);

  const currentAlert = alerts.find((a) => !acknowledgedIds.has(a.id));

  const handleAcknowledge = () => {
    if (!currentAlert) return;
    alarmRef.current?.stop();
    const newAcked = new Set(acknowledgedIds);
    newAcked.add(currentAlert.id);
    setAcknowledgedIds(newAcked);
    localStorage.setItem(
      "acknowledged_emergency_alerts",
      JSON.stringify([...newAcked])
    );
  };

  if (!currentAlert) return null;

  // Parse trigger_snippet for emergency contact info
  let snippetData: any = {};
  try {
    if (currentAlert.trigger_snippet) {
      snippetData = JSON.parse(currentAlert.trigger_snippet);
    }
  } catch {
    snippetData = { raw: currentAlert.trigger_snippet };
  }

  const studentUsername = snippetData.student_username || snippetData.username || "Unknown";
  const studentEterniaId = snippetData.student_eternia_id || snippetData.eternia_id || "";
  const emergencyName = snippetData.emergency_name || snippetData.contact_name || "";
  const emergencyPhone = snippetData.emergency_phone || snippetData.contact_phone || "";
  const emergencyRelation = snippetData.emergency_relation || snippetData.relation || "";
  const transcript = snippetData.transcript || snippetData.reason || currentAlert.justification_encrypted || "";

  return (
    <AlertDialog open={true} onOpenChange={() => { /* prevent dismiss without ack */ }}>
      <AlertDialogContent className="max-w-lg border-destructive/50 bg-card">
        <AlertDialogHeader>
          {/* Pulsing emergency header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-destructive text-lg font-bold">
                🚨 EMERGENCY CASE
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(new Date(currentAlert.created_at), "dd MMM yyyy, hh:mm a")}
              </p>
            </div>
          </div>

          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-2">
              {/* Student Info */}
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Student Information</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Username</span>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <User className="w-3 h-3" /> {studentUsername}
                    </p>
                  </div>
                  {studentEterniaId && (
                    <div>
                      <span className="text-muted-foreground text-xs">Eternia ID</span>
                      <p className="font-mono text-xs text-foreground">{studentEterniaId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              {(emergencyName || emergencyPhone) && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {emergencyName && (
                      <div>
                        <span className="text-muted-foreground text-xs">Name</span>
                        <p className="font-medium text-foreground">{emergencyName}</p>
                      </div>
                    )}
                    {emergencyRelation && (
                      <div>
                        <span className="text-muted-foreground text-xs">Relation</span>
                        <p className="text-foreground">{emergencyRelation}</p>
                      </div>
                    )}
                    {emergencyPhone && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">Phone</span>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {emergencyPhone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Escalation Reason */}
              {transcript && (
                <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Escalation Reason</p>
                  <p className="text-sm text-foreground line-clamp-3">{transcript}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          {emergencyPhone && (
            <Button
              variant="destructive"
              size="sm"
              asChild
              className="w-full sm:w-auto"
            >
              <a href={`tel:${emergencyPhone}`}>
                <Phone className="w-4 h-4 mr-1" /> Call Contact
              </a>
            </Button>
          )}
          {onViewFlags && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                handleAcknowledge();
                onViewFlags();
              }}
            >
              <Eye className="w-4 h-4 mr-1" /> View in Flags
            </Button>
          )}
          <AlertDialogAction
            onClick={handleAcknowledge}
            className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
          >
            Acknowledge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EmergencyAlertOverlay;
