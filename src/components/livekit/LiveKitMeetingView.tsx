import { useState, useCallback, useEffect, useRef } from "react";
import { useRoomContext, useParticipants, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, ConnectionState, Track, Participant } from "livekit-client";
import { Loader2, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LiveKitParticipantView from "./LiveKitParticipantView";
import LiveKitControls from "./LiveKitControls";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useSilenceDetection } from "@/hooks/useSilenceDetection";
import TherapistSessionControls from "@/components/blackbox/TherapistSessionControls";
import AISuggestionPopup from "@/components/blackbox/AISuggestionPopup";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LiveKitMeetingViewProps {
  meetingId: string;
  onMeetingLeave: () => void;
  audioOnly?: boolean;
  sessionId?: string;
  sessionType?: "blackbox" | "peer";
  enableMonitoring?: boolean;
  onRiskDetected?: (level: number, snippet: string) => void;
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

function useParticipantAudioMeter(participant: Participant | undefined, enabled: boolean) {
  const [level, setLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  const micPub = participant?.getTrackPublication(Track.Source.Microphone);
  const isMicOn = micPub?.isMuted === false && !!micPub?.track;
  const track = micPub?.track?.mediaStreamTrack;

  useEffect(() => {
    if (!enabled || !participant || !isMicOn || !track) {
      setLevel(0);
      return;
    }

    let cancelled = false;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
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
      console.warn("[LiveKit AudioMeter] Error analyzing track audio:", err);
    }

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
  }, [participant, isMicOn, track, enabled]);

  return level;
}

export const LiveKitMeetingView = ({
  meetingId,
  onMeetingLeave,
  audioOnly = false,
  sessionId,
  enableMonitoring = false,
  sessionType = "blackbox",
  onRiskDetected,
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
}: LiveKitMeetingViewProps) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const [connectionState, setConnectionState] = useState<ConnectionState>(room.state);
  const [isPhoneScreen, setIsPhoneScreen] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const hasFiredJoined = useRef(false);
  const unmountedRef = useRef(false);

  // Screen resize detection
  useEffect(() => {
    const checkScreen = () => {
      setIsPhoneScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Sync connection state and lifecycle events
  useEffect(() => {
    unmountedRef.current = false;

    const handleStateChange = (state: ConnectionState) => {
      if (unmountedRef.current) return;
      setConnectionState(state);

      if (state === ConnectionState.Connected && !hasFiredJoined.current) {
        hasFiredJoined.current = true;
        setSdkError(null);
        onJoined?.();
      } else if (state === ConnectionState.Disconnected) {
        hasFiredJoined.current = false;
        onMeetingLeave();
      }
    };

    room.on(RoomEvent.ConnectionStateChanged, handleStateChange);

    // Initial check if already connected
    if (room.state === ConnectionState.Connected && !hasFiredJoined.current) {
      hasFiredJoined.current = true;
      onJoined?.();
    }

    return () => {
      unmountedRef.current = true;
      room.off(RoomEvent.ConnectionStateChanged, handleStateChange);
    };
  }, [room, onJoined, onMeetingLeave]);

  // Clean up on pagehide
  useEffect(() => {
    const leaveActiveMeeting = () => {
      try {
        room.disconnect();
      } catch (err) {
        console.warn("[LiveKit] Leave on pagehide error:", err);
      }
    };

    window.addEventListener("pagehide", leaveActiveMeeting);
    return () => {
      window.removeEventListener("pagehide", leaveActiveMeeting);
      leaveActiveMeeting();
    };
  }, [room]);

  // Expose toggleMic to parent
  useEffect(() => {
    if (onToggleMicReady && localParticipant && connectionState === ConnectionState.Connected) {
      onToggleMicReady(() => {
        localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
      });
    }
  }, [onToggleMicReady, localParticipant, connectionState]);

  // Notify parent of mic status changes
  useEffect(() => {
    if (onMicStatusChange !== undefined && connectionState === ConnectionState.Connected) {
      onMicStatusChange(isMicrophoneEnabled);
    }
  }, [isMicrophoneEnabled, onMicStatusChange, connectionState]);

  // Expose leave function to parent
  useEffect(() => {
    if (onLeaveReady) {
      onLeaveReady(() => {
        room.disconnect();
        onMeetingLeave();
      });
    }
  }, [room, onLeaveReady, onMeetingLeave]);

  // Enumerate output devices
  const refreshAudioOutputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAudioOutputs(outputs);

      if (outputs.length > 0 && !selectedSpeaker) {
        const defaultSpeaker =
          outputs.find(
            (d) =>
              d.label.toLowerCase().includes("speaker") ||
              d.label.toLowerCase().includes("loudspeaker")
          ) || outputs[0];
        setSelectedSpeaker(defaultSpeaker.deviceId);
      }
    } catch (err) {
      console.warn("[LiveKit] Failed to enumerate audio outputs:", err);
    }
  }, [selectedSpeaker]);

  useEffect(() => {
    refreshAudioOutputs();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", refreshAudioOutputs);
      return () => navigator.mediaDevices.removeEventListener("devicechange", refreshAudioOutputs);
    }
  }, [refreshAudioOutputs]);

  // Switch camera handler
  const handleSwitchCamera = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      if (videoDevices.length <= 1) {
        toast.info("Only one camera available.");
        return;
      }

      const activePub = localParticipant.getTrackPublication(Track.Source.Camera);
      const currentDeviceId = activePub?.track?.mediaStreamTrack?.getSettings()?.deviceId;

      let nextDevice = videoDevices[0];
      if (currentDeviceId) {
        const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
        if (currentIndex !== -1) {
          nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];
        }
      }

      await room.switchActiveDevice("videoinput", nextDevice.deviceId);
      toast.success(`Switched camera to ${nextDevice.label || "next camera"}`);
    } catch (err) {
      console.error("[LiveKit] Failed to switch camera:", err);
      toast.error("Failed to switch camera");
    }
  }, [localParticipant, room]);

  // AI audio monitoring
  const audioMonitor = useAudioMonitor({
    sessionId: sessionId || meetingId,
    sessionType,
    enabled: enableMonitoring && connectionState === ConnectionState.Connected,
    classifyIntervalMs: 10000,
    onRiskDetected: useCallback(
      (level: number, snippet: string) => {
        onRiskDetected?.(level, snippet);
      },
      [onRiskDetected]
    ),
  });

  // Expose capture snippet function to parent
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && onCaptureSnippetReady) {
      onCaptureSnippetReady(audioMonitor.captureEscalationSnippetAsync);
    }
  }, [connectionState, onCaptureSnippetReady, audioMonitor.captureEscalationSnippetAsync]);

  // Silence auto-end handling
  const handleSilenceAutoEnd = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("refund-blackbox-session", {
        body: { session_id: sessionId, reason: "Auto-ended: 5 min silence" },
      });

      if (error) {
        console.error("[LiveKit SilenceAutoEnd] Refund function error:", error);
        toast.error("Inactivity timeout: Failed to issue auto-refund.");
      } else {
        toast.info("Session ended due to inactivity. Student has been refunded.");
      }

      onSilenceAutoEnd?.();
      room.disconnect();
      onMeetingLeave();
    } catch (err) {
      console.error("[LiveKit SilenceAutoEnd] Failed to auto-end session:", err);
      toast.error("Failed to auto-end session");
    }
  }, [sessionId, onSilenceAutoEnd, room, onMeetingLeave]);

  // Find remote student participant (for therapist view)
  const remoteParticipant = participants.find((p) => !p.isLocal);

  // Monitor student's audio level (remote participant)
  const remoteAudioLevel = useParticipantAudioMeter(
    remoteParticipant,
    isTherapistView && connectionState === ConnectionState.Connected
  );

  const silenceDetection = useSilenceDetection({
    enabled: isTherapistView && connectionState === ConnectionState.Connected,
    audioLevel: remoteAudioLevel,
    warningThresholdSec: 120,
    autoEndThresholdSec: 300,
    onWarning: () => toast.warning("Student has been silent for 2+ minutes"),
    onAutoEnd: handleSilenceAutoEnd,
  });

  // Local audio level for animations/meters
  const localAudioLevel = useParticipantAudioMeter(
    localParticipant,
    connectionState === ConnectionState.Connected
  );

  useEffect(() => {
    if (onAudioLevelChange && connectionState === ConnectionState.Connected) {
      onAudioLevelChange(localAudioLevel);
    }
  }, [localAudioLevel, onAudioLevelChange, connectionState]);

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

  // Render connecting or reconnecting states
  if (
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting
  ) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {connectionState === ConnectionState.Reconnecting
            ? "Reconnecting to secure session..."
            : "Joining the secure session..."}
        </p>
      </div>
    );
  }

  // Render error or disconnected state
  if (connectionState === ConnectionState.Disconnected && sdkError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-8 h-8 text-yellow-400" />
        <p className="text-muted-foreground text-sm">{sdkError}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Reload
        </Button>
      </div>
    );
  }

  // Filter and de-duplicate participants
  const displayParticipants = participants.filter(
    (p) => !(audioOnly && p.isLocal)
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* AI Monitoring Bar */}
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

      {/* Main Video / Audio Tiles Container */}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto">
        {(() => {
          const remoteP = displayParticipants.find((p) => !p.isLocal);
          const localP = localParticipant;

          // 2-participant mobile view with Picture-in-Picture floating tile
          if (!audioOnly && displayParticipants.length === 2 && localP && remoteP && isPhoneScreen) {
            return (
              <div className="relative w-full h-full min-h-[400px]">
                <div className="w-full h-full [&>div]:h-full [&>div]:w-full">
                  <LiveKitParticipantView
                    participant={remoteP}
                    audioOnly={false}
                    speakerDeviceId={selectedSpeaker}
                    volumeBoost={volumeBoost}
                  />
                </div>
                <div className="absolute bottom-4 left-4 w-28 aspect-[3/4] z-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-2xl [&>div]:h-full [&>div]:w-full bg-background">
                  <LiveKitParticipantView
                    participant={localP}
                    audioOnly={false}
                    speakerDeviceId={selectedSpeaker}
                    volumeBoost={volumeBoost}
                  />
                </div>
              </div>
            );
          }

          // Responsive grid
          return (
            <div
              className={`grid gap-4 h-full ${
                displayParticipants.length <= 1
                  ? "grid-cols-1"
                  : displayParticipants.length <= 4
                  ? "grid-cols-2"
                  : "grid-cols-3"
              }`}
            >
              {displayParticipants.map((p) => (
                <LiveKitParticipantView
                  key={p.sid || p.identity}
                  participant={p}
                  audioOnly={audioOnly}
                  speakerDeviceId={selectedSpeaker}
                  volumeBoost={volumeBoost}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Controls Bar */}
      {!hideControls && (
        <LiveKitControls
          audioOnly={audioOnly}
          onEscalate={onEscalate}
          onSwitchCamera={handleSwitchCamera}
          audioOutputs={audioOutputs}
          selectedSpeaker={selectedSpeaker}
          onSpeakerChange={setSelectedSpeaker}
          volumeBoost={volumeBoost}
          onVolumeBoostChange={setVolumeBoost}
          onLeave={() => {
            room.disconnect();
            onMeetingLeave();
          }}
        />
      )}

      {/* Therapist Session Controls */}
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

export default LiveKitMeetingView;
