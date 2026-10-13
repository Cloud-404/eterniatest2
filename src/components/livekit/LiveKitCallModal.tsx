import { useState, useCallback, useEffect, useRef } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { Video, Phone, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLiveKitToken, MediaSessionKind } from "@/lib/livekit";
import { supabase } from "@/integrations/supabase/client";
import LiveKitMeetingView from "./LiveKitMeetingView";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface LiveKitCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName?: string;
  participantId?: string;
  mode?: "video" | "audio";
  appointmentId?: string;
  existingRoomId?: string;
  sessionId?: string;
  sessionType?: "blackbox" | "peer";
  isL3?: boolean;
  enableMonitoring?: boolean;
  onRiskDetected?: (level: number, snippet: string) => void;
  isTherapistView?: boolean;
  onCaptureSnippetReady?: (captureFn: () => Promise<string>) => void;
  onLeaveReady?: (leaveFn: () => void) => void;
  autoStart?: boolean;
  onCallJoined?: () => void;
  onEscalate?: () => void;
  onAudioLevelChange?: (level: number) => void;
}

export const LiveKitCallModal = ({
  isOpen,
  onClose,
  participantName = "Participant",
  participantId,
  mode = "video",
  appointmentId,
  existingRoomId,
  sessionId,
  sessionType = "blackbox",
  isL3 = false,
  enableMonitoring = false,
  onRiskDetected,
  isTherapistView = false,
  onCaptureSnippetReady,
  onLeaveReady,
  autoStart = false,
  onCallJoined,
  onEscalate,
  onAudioLevelChange,
}: LiveKitCallModalProps) => {
  const queryClient = useQueryClient();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const startInFlightRef = useRef(false);

  const isAudioOnly = mode === "audio";

  const startCall = useCallback(async () => {
    if (startInFlightRef.current || isLoading) return;
    startInFlightRef.current = true;
    setIsLoading(true);

    try {
      let kind: MediaSessionKind;
      let targetId: string;

      if (appointmentId) {
        kind = "appointment";
        targetId = appointmentId;
      } else if (sessionType === "peer" && sessionId) {
        kind = "peer";
        targetId = sessionId;
      } else if (sessionId) {
        kind = isL3 ? "l3" : "blackbox";
        targetId = sessionId;
      } else {
        throw new Error("No session or appointment identifier specified.");
      }

      const connection = await getLiveKitToken({ kind, id: targetId });

      setToken(connection.token);
      setServerUrl(connection.url);
      setRoomName(connection.roomName);
    } catch (error: any) {
      console.error("[LiveKitCallModal] startCall error:", error);
      toast.error(error.message || "Failed to start call");
    } finally {
      setIsLoading(false);
      startInFlightRef.current = false;
    }
  }, [appointmentId, sessionId, sessionType, isL3, isLoading]);

  // Auto-start when modal opens if requested
  useEffect(() => {
    if (isOpen && autoStart && !token && !isLoading && !startInFlightRef.current) {
      startCall();
    }
  }, [isOpen, autoStart, token, isLoading, startCall]);

  const handleLeave = useCallback(async () => {
    if (appointmentId && token) {
      try {
        await supabase
          .from("appointments")
          .update({ status: "completed" } as any)
          .eq("id", appointmentId);
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
      } catch (err) {
        console.error("Failed to mark appointment as completed:", err);
      }
    }

    setRoomName(null);
    setToken(null);
    setServerUrl(null);
    startInFlightRef.current = false;
    onClose();
  }, [appointmentId, token, onClose, queryClient]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[80vh] bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            {isAudioOnly ? (
              <Phone className="w-5 h-5 text-primary" />
            ) : (
              <Video className="w-5 h-5 text-primary" />
            )}
            <span className="font-semibold font-display">
              {isAudioOnly ? "Audio" : "Video"} Session
            </span>
            {roomName && (
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                {roomName}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!token || !serverUrl ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-eternia flex items-center justify-center shadow-lg">
                {isAudioOnly ? (
                  <Phone className="w-12 h-12 text-primary-foreground" />
                ) : (
                  <Video className="w-12 h-12 text-primary-foreground" />
                )}
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold font-display mb-2">
                  {isLoading ? "Connecting..." : "Ready to connect?"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {isLoading
                    ? "Setting up secure, authorized session"
                    : `Start a secure ${isAudioOnly ? "audio" : "video"} session`}
                </p>
              </div>
              <Button
                onClick={startCall}
                disabled={isLoading}
                className="btn-primary text-lg px-8 py-4 rounded-xl shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  `Start ${isAudioOnly ? "Audio" : "Video"} Call`
                )}
              </Button>
            </div>
          ) : (
            <LiveKitRoom
              token={token}
              serverUrl={serverUrl}
              connect={true}
              audio={true}
              video={!isAudioOnly}
              className="h-full w-full flex flex-col"
              onDisconnected={handleLeave}
            >
              <LiveKitMeetingView
                meetingId={roomName || ""}
                onMeetingLeave={handleLeave}
                audioOnly={isAudioOnly}
                sessionId={sessionId || appointmentId}
                sessionType={sessionType}
                enableMonitoring={enableMonitoring}
                onRiskDetected={onRiskDetected}
                isTherapistView={isTherapistView}
                onCaptureSnippetReady={onCaptureSnippetReady}
                onLeaveReady={onLeaveReady}
                onJoined={onCallJoined}
                onEscalate={onEscalate}
                onAudioLevelChange={onAudioLevelChange}
              />
            </LiveKitRoom>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveKitCallModal;
