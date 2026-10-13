import { useEffect, useRef, useCallback } from "react";
import { Participant, Track } from "livekit-client";
import { useEnsureTrackRef, VideoTrack } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface LiveKitParticipantViewProps {
  participant: Participant;
  audioOnly?: boolean;
  speakerDeviceId?: string;
  volumeBoost?: number;
}

export const LiveKitParticipantView = ({
  participant,
  audioOnly = false,
  speakerDeviceId,
  volumeBoost = 1.0,
}: LiveKitParticipantViewProps) => {
  const micRef = useRef<HTMLAudioElement>(null);
  const isLocal = participant.isLocal;
  const isSpeaking = participant.isSpeaking;

  // Track publications
  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const micPub = participant.getTrackPublication(Track.Source.Microphone);

  const isWebcamOn = cameraPub?.isMuted === false && !!cameraPub?.track;
  const isMicOn = micPub?.isMuted === false && !!micPub?.track;

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const attachedTrackIdRef = useRef<string | null>(null);

  const cleanupAudioNodes = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try { gainNodeRef.current.disconnect(); } catch {}
      gainNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    destinationNodeRef.current = null;
  }, []);

  // Update output speaker device using setSinkId
  useEffect(() => {
    const el = micRef.current;
    if (!el || isLocal) return;

    if (speakerDeviceId && typeof (el as any).setSinkId === "function") {
      (el as any).setSinkId(speakerDeviceId).catch((err: any) => {
        console.error(`[LiveKit AudioRouting] Failed to setSinkId to ${speakerDeviceId}:`, err);
      });
    }
  }, [speakerDeviceId, isLocal]);

  // Audio track playback with optional Web Audio volume boost
  useEffect(() => {
    const el = micRef.current;
    if (!el) return;

    // NEVER playback local participant's own mic to themselves
    if (isLocal) {
      el.srcObject = null;
      attachedTrackIdRef.current = null;
      cleanupAudioNodes();
      return;
    }

    const audioTrack = micPub?.track?.mediaStreamTrack;

    if (isMicOn && audioTrack) {
      const trackId = audioTrack.id;
      if (
        attachedTrackIdRef.current === trackId &&
        el.srcObject &&
        gainNodeRef.current &&
        gainNodeRef.current.gain.value === volumeBoost
      ) {
        return;
      }

      cleanupAudioNodes();

      const mediaStream = new MediaStream([audioTrack]);

      if (volumeBoost > 1.0) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(mediaStream);
          sourceNodeRef.current = source;

          const gainNode = audioCtx.createGain();
          gainNode.gain.value = volumeBoost;
          gainNodeRef.current = gainNode;

          const destination = audioCtx.createMediaStreamDestination();
          destinationNodeRef.current = destination;

          source.connect(gainNode);
          gainNode.connect(destination);

          el.srcObject = destination.stream;
        } catch (err) {
          console.error("[LiveKit AudioRouting] Web Audio boost failed, using direct stream:", err);
          el.srcObject = mediaStream;
        }
      } else {
        el.srcObject = mediaStream;
      }

      attachedTrackIdRef.current = trackId;

      if (speakerDeviceId && typeof (el as any).setSinkId === "function") {
        (el as any).setSinkId(speakerDeviceId).catch(() => {});
      }

      el.play().catch((err) => console.error("[LiveKit Audio] Play failed:", err));
    } else {
      el.srcObject = null;
      attachedTrackIdRef.current = null;
      cleanupAudioNodes();
    }
  }, [micPub?.track, isMicOn, isLocal, volumeBoost, speakerDeviceId, cleanupAudioNodes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioNodes();
    };
  }, [cleanupAudioNodes]);

  const showVideo = !audioOnly && isWebcamOn && !!cameraPub?.track;
  const displayName = participant.name || participant.identity || "Participant";

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-muted border ${
      isSpeaking ? "border-primary/80 ring-2 ring-primary/30" : "border-border"
    } transition-all duration-200`}>
      {showVideo && cameraPub ? (
        <div className="h-full w-full aspect-video object-cover">
          <VideoTrack
            trackRef={{
              participant,
              source: Track.Source.Camera,
              publication: cameraPub,
            }}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video flex items-center justify-center bg-muted">
          <div className="w-20 h-20 rounded-full bg-gradient-eternia flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground font-display">
              {(displayName.charAt(0) || "U").toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${
          isLocal ? "p-1.5 bg-black/50" : "p-3 bg-gradient-to-t from-background/90 to-transparent"
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span
            className={`font-medium text-foreground truncate ${
              isLocal ? "text-[10px] max-w-[65%]" : "text-sm"
            }`}
          >
            {displayName} {isLocal && "(You)"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isMicOn ? (
              <Mic className={`${isLocal ? "w-3 h-3" : "w-4 h-4"} text-primary`} />
            ) : (
              <MicOff className={`${isLocal ? "w-3 h-3" : "w-4 h-4"} text-destructive`} />
            )}
            {!audioOnly &&
              (isWebcamOn ? (
                <Video className={`${isLocal ? "w-3 h-3" : "w-4 h-4"} text-primary`} />
              ) : (
                <VideoOff className={`${isLocal ? "w-3 h-3" : "w-4 h-4"} text-destructive`} />
              ))}
          </div>
        </div>
      </div>

      {/* Remote audio playback element (muted for local participant) */}
      <audio ref={micRef} autoPlay playsInline muted={isLocal} />
    </div>
  );
};

export default LiveKitParticipantView;
