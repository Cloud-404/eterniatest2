import { useState, useCallback, useEffect, useRef } from "react";
import { MeetingProvider } from "@videosdk.live/react-sdk";
import { Video, Phone, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createVideoSDKRoom, getVideoSDKToken } from "@/lib/videosdk";
import { supabase } from "@/integrations/supabase/client";
import MeetingView from "./MeetingView";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
  participantId?: string;
  mode?: "video" | "audio";
  appointmentId?: string;
  existingRoomId?: string;
  sessionId?: string;
  sessionType?: "blackbox" | "peer";
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

const VideoCallModal = ({
  isOpen,
  onClose,
  participantName,
  participantId,
  mode = "video",
  appointmentId,
  existingRoomId,
  sessionId,
  sessionType = "blackbox",
  enableMonitoring = false,
  onRiskDetected,
  isTherapistView = false,
  onCaptureSnippetReady,
  onLeaveReady,
  autoStart = false,
  onCallJoined,
  onEscalate,
  onAudioLevelChange,
}: VideoCallModalProps) => {
  const queryClient = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const startInFlightRef = useRef(false); // prevent double startCall

  const isAudioOnly = mode === "audio";

  const startCall = useCallback(async () => {
    if (startInFlightRef.current || isLoading) return;
    startInFlightRef.current = true;
    setIsLoading(true);
    try {
      if (appointmentId) {
        const { data: apt } = await supabase
          .from("appointments")
          .select("room_id")
          .eq("id", appointmentId)
          .single();

        if (apt?.room_id) {
          const t = await getVideoSDKToken();
          setToken(t);
          setMeetingId(apt.room_id);
          return;
        }

        const { token: t, roomId } = await createVideoSDKRoom();
        // Idempotent: only set room_id if still null
        const { data: updated } = await supabase
          .from("appointments")
          .update({ room_id: roomId } as any)
          .eq("id", appointmentId)
          .is("room_id", null)
          .select("room_id")
          .maybeSingle();

        // If another call already set room_id, use theirs
        const finalRoomId = updated?.room_id || roomId;
        if (!updated) {
          // Re-read canonical room_id
          const { data: reread } = await supabase
            .from("appointments")
            .select("room_id")
            .eq("id", appointmentId)
            .single();
          if (reread?.room_id) {
            setToken(t);
            setMeetingId(reread.room_id);
            return;
          }
        }

        setToken(t);
        setMeetingId(finalRoomId);
        return;
      }

      if (existingRoomId) {
        const t = await getVideoSDKToken();
        setToken(t);
        setMeetingId(existingRoomId);
      } else {
        const { token: t, roomId } = await createVideoSDKRoom();
        setToken(t);
        setMeetingId(roomId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start call",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      startInFlightRef.current = false;
    }
  }, [appointmentId, existingRoomId, isLoading]);

  // Auto-start: fire once on open
  useEffect(() => {
    if (isOpen && autoStart && !token && !meetingId && !isLoading && !startInFlightRef.current) {
      startCall();
    }
  }, [isOpen, autoStart]); // intentionally minimal deps

  const handleLeave = useCallback(async () => {
    if (appointmentId && meetingId) {
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

    setMeetingId(null);
    setToken(null);
    startInFlightRef.current = false;
    onClose();
  }, [appointmentId, meetingId, onClose, queryClient]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[80vh] bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {isAudioOnly ? (
              <Phone className="w-5 h-5 text-primary" />
            ) : (
              <Video className="w-5 h-5 text-primary" />
            )}
            <span className="font-semibold font-display">
              {isAudioOnly ? "Audio" : "Video"} Session
            </span>
            {meetingId && (
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                {meetingId}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!token || !meetingId ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-eternia flex items-center justify-center">
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
                  {isLoading ? "Setting up secure session" : `Start a secure, anonymous ${isAudioOnly ? "audio" : "video"} session`}
                </p>
              </div>
              <Button
                onClick={startCall}
                disabled={isLoading}
                className="btn-primary text-lg px-8 py-4"
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
            <MeetingProvider
              config={{
                meetingId,
                micEnabled: true,
                webcamEnabled: !isAudioOnly,
                name: participantName,
                participantId,
                debugMode: false,
              }}
              token={token}
              joinWithoutUserInteraction={false}
            >
              <MeetingView
                meetingId={meetingId}
                onMeetingLeave={handleLeave}
                audioOnly={isAudioOnly}
                sessionId={sessionId}
                sessionType={sessionType}
                enableMonitoring={enableMonitoring}
                onRiskDetected={onRiskDetected}
                isTherapistView={isTherapistView}
                onCaptureSnippetReady={onCaptureSnippetReady}
                onLeaveReady={onLeaveReady}
                autoJoin={true}
                onJoined={onCallJoined}
                onEscalate={onEscalate}
                onAudioLevelChange={onAudioLevelChange}
              />
            </MeetingProvider>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
