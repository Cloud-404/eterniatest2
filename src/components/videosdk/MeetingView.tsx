import { useState, useCallback, useEffect, useRef } from "react";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { Loader2, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ParticipantView from "./ParticipantView";
import MeetingControls from "./MeetingControls";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useSilenceDetection } from "@/hooks/useSilenceDetection";
import TherapistSessionControls from "@/components/blackbox/TherapistSessionControls";
import AISuggestionPopup from "@/components/blackbox/AISuggestionPopup";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MeetingViewProps {
  meetingId: string;
  onMeetingLeave: () => void;
  audioOnly?: boolean;
  sessionId?: string;
  sessionType?: "blackbox" | "peer";
  enableMonitoring?: boolean;
  onRiskDetected?: (level: number, snippet: string) => void;
  autoJoin?: boolean;
  onError?: (error: string) => void;
  isTherapistView?: boolean;
  onSilenceAutoEnd?: () => void;
  onJoined?: () => void;
  onJoinError?: (error: string) => void;
  onCaptureSnippetReady?: (captureFn: () => Promise<string>) => void;
  onLeaveReady?: (leaveFn: () => void) => void;
  onEscalateFromSuggestion?: (snippet: string, riskLevel: number) => void;
  hideControls?: boolean;
  onToggleMicReady?: (toggleFn: () => void) => void;
  onMicStatusChange?: (micOn: boolean) => void;
  onEscalate?: () => void;
  onAudioLevelChange?: (level: number) => void;
}

const riskColors: Record<number, string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  3: "bg-destructive/20 text-destructive border-destructive/30",
};

const riskLabels: Record<number, string> = {
  0: "Normal",
  1: "L1 — Mild",
  2: "L2 — Moderate",
  3: "L3 — Critical",
};

function useParticipantAudioLevel(participantId: string | undefined, enabled: boolean) {
  const [level, setLevel] = useState(0);
  const participant = useParticipant(participantId || "");
  const micStream = participant?.micStream;
  const micOn = participant?.micOn;
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !participantId || !micOn || !micStream?.track) {
      setLevel(0);
      return;
    }

    let cancelled = false;
    const track = micStream.track;

    const start = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        
        const mediaStream = new MediaStream([track]);
        const source = audioCtx.createMediaStreamSource(mediaStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (cancelled || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          setLevel(avg);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("Error analyzing participant audio stream", err);
      }
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      setLevel(0);
    };
  }, [participantId, micStream, micOn, enabled]);

  return level;
}

const MeetingView = ({
  meetingId,
  onMeetingLeave,
  audioOnly = false,
  sessionId,
  enableMonitoring = false,
  sessionType = "blackbox",
  onRiskDetected,
  autoJoin = false,
  onError,
  isTherapistView = false,
  onSilenceAutoEnd,
  onJoined,
  onJoinError,
  onCaptureSnippetReady,
  onLeaveReady,
  onEscalateFromSuggestion,
  hideControls = false,
  onToggleMicReady,
  onMicStatusChange,
  onEscalate,
  onAudioLevelChange,
}: MeetingViewProps) => {
  const [joined, setJoined] = useState<string | null>(null);
  const joinedRef = useRef<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const hasAutoJoined = useRef(false);
  const joinInFlightRef = useRef(false); // single in-flight join lock
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinSucceeded = useRef(false);
  const unmountedRef = useRef(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isPhoneScreen, setIsPhoneScreen] = useState(false);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0);

  useEffect(() => {
    const checkScreen = () => {
      setIsPhoneScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Force periodic updates for the first 10 seconds of call to ensure
  // async displayNames resolve and collapse duplicate screen tiles immediately.
  useEffect(() => {
    if (joined === "JOINED") {
      const interval = setInterval(() => {
        setForceUpdate((prev) => prev + 1);
      }, 1000);
      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [joined]);

  // Cleanup on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const { join, leave, participants, localParticipant, toggleMic, localMicOn, getWebcams, changeWebcam } = useMeeting({
    onMeetingJoined: () => {
      if (unmountedRef.current) return;
      console.log("[MeetingView] onMeetingJoined fired");
      joinSucceeded.current = true;
      joinInFlightRef.current = false;
      joinedRef.current = "JOINED";
      setJoined("JOINED");
      setTimedOut(false);
      setSdkError(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onJoined?.();
    },
    onMeetingLeft: () => {
      console.log("[MeetingView] onMeetingLeft fired");
      joinInFlightRef.current = false;
      joinedRef.current = null;
      if (unmountedRef.current) return;
      setJoined(null);
      onMeetingLeave();
    },
    onError: (error: any) => {
      if (unmountedRef.current) return;
      console.error("[MeetingView] SDK onError:", error);
      const msg = error?.message || error?.code
        ? `VideoSDK error ${error.code || ""}: ${error.message || "Unknown"}`
        : "Video service connection failed";
      setSdkError(msg);
      joinedRef.current = null;
      joinInFlightRef.current = false;
      setJoined(null);
      setTimedOut(true);
      onError?.(msg);
      onJoinError?.(msg);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    onMeetingStateChanged: (data: any) => {
      console.log("[MeetingView] Meeting state changed:", data?.state || data);
    },
  });

  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  useEffect(() => {
    const leaveActiveMeeting = () => {
      if (!joinedRef.current) return;
      try {
        leaveRef.current();
      } catch (error) {
        console.warn("[MeetingView] Leave during cleanup failed:", error);
      }
    };

    window.addEventListener("pagehide", leaveActiveMeeting);
    return () => {
      window.removeEventListener("pagehide", leaveActiveMeeting);
      leaveActiveMeeting();
    };
  }, []);

  // Expose toggleMic to parent only after joined
  useEffect(() => {
    if (onToggleMicReady && toggleMic && joined === "JOINED") {
      onToggleMicReady(() => toggleMic());
    }
  }, [toggleMic, onToggleMicReady, joined]);

  // Notify parent of mic status changes
  useEffect(() => {
    if (onMicStatusChange !== undefined && localMicOn !== undefined && joined === "JOINED") {
      onMicStatusChange?.(localMicOn);
    }
  }, [localMicOn, onMicStatusChange, joined]);

  // Auto-join with single-attempt lock — no recursive retries
  useEffect(() => {
    if (!autoJoin || hasAutoJoined.current) return;
    if (!meetingId) return;

    hasAutoJoined.current = true;
    joinSucceeded.current = false;

    const doJoin = () => {
      if (unmountedRef.current || joinSucceeded.current || joinedRef.current === "JOINED" || joinInFlightRef.current) return;
      joinInFlightRef.current = true;
      console.log(`[MeetingView] Auto-join attempt, meetingId: ${meetingId}`);
      joinedRef.current = "JOINING";
      setJoined("JOINING");
      join();
    };

    // Request microphone permission before joining
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          if (!unmountedRef.current) {
            setTimeout(doJoin, 300);
          }
        })
        .catch((err) => {
          console.error("[MeetingView] Mic permission denied:", err);
          toast.error("Microphone access denied. Please allow microphone permission and try again.");
          onJoinError?.("Microphone permission denied");
        });
    } else {
      setTimeout(doJoin, 300);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [autoJoin, meetingId, join, onJoinError]);

  // Timeout
  useEffect(() => {
    if (joined === "JOINING") {
      timeoutRef.current = setTimeout(() => {
        if (unmountedRef.current) return;
        console.warn("[MeetingView] Join timed out after 20s");
        joinInFlightRef.current = false;
        setTimedOut(true);
        onJoinError?.("Connection timed out");
      }, 20000);
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }
  }, [joined, onJoinError]);

  // Enumerate output devices and switch camera handlers
  const refreshAudioOutputs = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAudioOutputs(outputs);

      if (outputs.length > 0 && !selectedSpeaker) {
        const defaultSpeaker = outputs.find(
          (d) => d.label.toLowerCase().includes("speaker") || d.label.toLowerCase().includes("loudspeaker")
        ) || outputs[0];
        setSelectedSpeaker(defaultSpeaker.deviceId);
      }
    } catch (err) {
      console.error("Failed to enumerate audio output devices:", err);
    }
  }, [selectedSpeaker]);

  useEffect(() => {
    refreshAudioOutputs();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", refreshAudioOutputs);
      return () => navigator.mediaDevices.removeEventListener("devicechange", refreshAudioOutputs);
    }
  }, [refreshAudioOutputs]);

  const handleSwitchCamera = useCallback(async () => {
    try {
      const webcams = await getWebcams();
      if (!webcams || webcams.length <= 1) {
        toast.info("Only one camera available or no cameras found.");
        return;
      }

      const activeDeviceId = localParticipant?.webcamStream?.track?.getSettings()?.deviceId;
      
      let nextDevice = webcams[0];
      if (activeDeviceId) {
        const currentIndex = webcams.findIndex((c) => c.deviceId === activeDeviceId);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % webcams.length;
          nextDevice = webcams[nextIndex];
        }
      } else {
        const backCam = webcams.find((c) => c.facingMode === "environment");
        nextDevice = backCam || webcams[1] || webcams[0];
      }

      changeWebcam(nextDevice.deviceId);
      toast.success(`Switched camera to ${nextDevice.label || "next camera"}`);
    } catch (err) {
      console.error("Failed to switch camera:", err);
      toast.error("Failed to switch camera");
    }
  }, [getWebcams, changeWebcam, localParticipant]);

  // AI audio monitoring
  const audioMonitor = useAudioMonitor({
    sessionId: sessionId || meetingId,
    sessionType,
    enabled: enableMonitoring && joined === "JOINED",
    classifyIntervalMs: 10000,
    onRiskDetected: useCallback((level: number, snippet: string) => {
      onRiskDetected?.(level, snippet);
    }, [onRiskDetected]),
  });

  // Expose async ±10s captureEscalationSnippetAsync to parent
  useEffect(() => {
    if (joined === "JOINED" && onCaptureSnippetReady) {
      onCaptureSnippetReady(audioMonitor.captureEscalationSnippetAsync);
    }
  }, [joined, onCaptureSnippetReady, audioMonitor.captureEscalationSnippetAsync]);

  // Expose leave function to parent
  useEffect(() => {
    if (onLeaveReady) {
      onLeaveReady(leave);
    }
  }, [leave, onLeaveReady]);

  const handleSilenceAutoEnd = useCallback(async () => {
    if (!sessionId) return;
    try {
      await supabase.functions.invoke("refund-blackbox-session", {
        body: { session_id: sessionId, reason: "Auto-ended: 5 min silence" },
      });
      toast.info("Session ended due to inactivity. Student has been refunded.");
      onSilenceAutoEnd?.();
      onMeetingLeave();
    } catch {
      toast.error("Failed to auto-end session");
    }
  }, [sessionId, onSilenceAutoEnd, onMeetingLeave]);

  // Find student participant (the participant who is NOT the local therapist)
  const studentParticipant = [...participants.values()].find(
    (p) => p.id !== localParticipant?.id
  );

  // Monitor student's audio level (remote participant)
  const studentAudioLevel = useParticipantAudioLevel(
    studentParticipant?.id,
    isTherapistView && joined === "JOINED"
  );

  const silenceDetection = useSilenceDetection({
    enabled: isTherapistView && joined === "JOINED",
    audioLevel: studentAudioLevel,
    warningThresholdSec: 120,
    autoEndThresholdSec: 300,
    onWarning: () => toast.warning("Student has been silent for 2+ minutes"),
    onAutoEnd: handleSilenceAutoEnd,
  });

  // Monitor local participant's audio level (for student voice animations)
  const localAudioLevel = useParticipantAudioLevel(
    localParticipant?.id,
    joined === "JOINED"
  );

  // Propagate local audio level changes up to parent page
  useEffect(() => {
    if (onAudioLevelChange && joined === "JOINED") {
      onAudioLevelChange(localAudioLevel);
    }
  }, [localAudioLevel, onAudioLevelChange, joined]);

  // Handle escalation from AI suggestion popup
  const handleEscalateFromSuggestion = useCallback(() => {
    const snippet = audioMonitor.captureEscalationSnippet();
    const riskLevel = audioMonitor.lastSuggestion?.risk_level || audioMonitor.riskLevel;
    audioMonitor.dismissSuggestion();
    
    if (onEscalateFromSuggestion) {
      onEscalateFromSuggestion(snippet, riskLevel);
    } else {
      toast.info("Escalation triggered — use the escalation panel to proceed.");
    }
  }, [audioMonitor, onEscalateFromSuggestion]);

  const joinMeeting = () => {
    if (joinInFlightRef.current) return;
    joinInFlightRef.current = true;
    joinedRef.current = "JOINING";
    setJoined("JOINING");
    setTimedOut(false);
    setSdkError(null);
    hasAutoJoined.current = true;
    joinSucceeded.current = false;
    join();
  };

  const retryJoin = () => {
    if (joinInFlightRef.current) return;
    setTimedOut(false);
    setSdkError(null);
    joinInFlightRef.current = true;
    joinedRef.current = "JOINING";
    setJoined("JOINING");
    hasAutoJoined.current = true;
    joinSucceeded.current = false;
    join();
  };

  if (joined === "JOINING" || (timedOut && joined !== "JOINED")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        {timedOut ? (
          <>
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
            <p className="text-muted-foreground text-sm">
              {sdkError || "Connection timed out — the video service may be unavailable"}
            </p>
            <Button onClick={retryJoin} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
            <Button onClick={onMeetingLeave} variant="ghost" size="sm" className="text-xs">
              Leave
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining the session...</p>
          </>
        )}
      </div>
    );
  }

  if (joined !== "JOINED") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Session ID</p>
          <p className="text-lg font-mono text-foreground">{meetingId}</p>
        </div>
        <button onClick={joinMeeting} className="btn-primary text-lg px-10 py-4 rounded-xl">
          Join Session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {enableMonitoring && (
        <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              AI Monitor {audioMonitor.isListening ? "Active" : "Inactive"}
            </span>
            {audioMonitor.isProcessing && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <Badge className={`text-[10px] ${riskColors[audioMonitor.riskLevel]}`}>
            {audioMonitor.riskLevel > 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
            {riskLabels[audioMonitor.riskLevel]}
          </Badge>
        </div>
      )}

      <div className="flex-1 min-h-0 p-4 overflow-y-auto">
        {(() => {
          // Build list, filtering out self (in audio-only) and de-duplicating
          // by displayName so duplicate logins of the same account
          // (e.g. an Expert signed in on two devices) collapse into one tile.
          const allIds = [...participants.keys()].filter(
            (id) => !(audioOnly && localParticipant && id === localParticipant.id)
          );
          const seenNames = new Set<string>();
          const participantIds: string[] = [];
          for (const id of allIds) {
            const p: any = participants.get(id);
            const key = (p?.displayName || p?.id || id).toString().trim().toLowerCase();
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            participantIds.push(id);
          }
          const localId = localParticipant?.id;
          const remoteId = participantIds.find(id => id !== localId);

          if (!audioOnly && participantIds.length === 2 && localId && remoteId && isPhoneScreen) {
            return (
              <div className="relative w-full h-full min-h-[400px]">
                {/* Remote participant is large / background */}
                <div className="w-full h-full [&>div]:h-full [&>div]:w-full">
                  <ParticipantView
                    participantId={remoteId}
                    audioOnly={false}
                    speakerDeviceId={selectedSpeaker}
                    volumeBoost={volumeBoost}
                  />
                </div>
                {/* Local participant is small / floating thumbnail in bottom-left corner */}
                <div className="absolute bottom-4 left-4 w-28 aspect-[3/4] z-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-2xl [&>div]:h-full [&>div]:w-full bg-background">
                  <ParticipantView
                    participantId={localId}
                    audioOnly={false}
                    speakerDeviceId={selectedSpeaker}
                    volumeBoost={volumeBoost}
                  />
                </div>
              </div>
            );
          }

          return (
            <div className={`grid gap-4 h-full ${
              participantIds.length <= 1 ? "grid-cols-1" : participantIds.length <= 4 ? "grid-cols-2" : "grid-cols-3"
            }`}>
              {participantIds.map((participantId) => (
                <ParticipantView
                  key={participantId}
                  participantId={participantId}
                  audioOnly={audioOnly}
                  speakerDeviceId={selectedSpeaker}
                  volumeBoost={volumeBoost}
                />
              ))}
            </div>
          );
        })()}
      </div>
      {!hideControls && (
        <MeetingControls
          audioOnly={audioOnly}
          onEscalate={onEscalate}
          onSwitchCamera={handleSwitchCamera}
          audioOutputs={audioOutputs}
          selectedSpeaker={selectedSpeaker}
          onSpeakerChange={setSelectedSpeaker}
          volumeBoost={volumeBoost}
          onVolumeBoostChange={setVolumeBoost}
        />
      )}
      {isTherapistView && sessionId && (
        <TherapistSessionControls
          sessionId={sessionId}
          silenceDurationSec={silenceDetection.silenceDurationSec}
          onSessionEnded={onMeetingLeave}
          captureEscalationSnippet={audioMonitor.captureEscalationSnippet}
        />
      )}

      {/* AI Suggestion Popup */}
      {enableMonitoring && audioMonitor.lastSuggestion && (
        <AISuggestionPopup
          suggestion={audioMonitor.lastSuggestion}
          onDismiss={audioMonitor.dismissSuggestion}
          onEscalate={handleEscalateFromSuggestion}
        />
      )}
    </div>
  );
};

export default MeetingView;
