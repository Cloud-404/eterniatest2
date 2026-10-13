import { useEffect, useRef, useCallback } from "react";
import { useParticipant, VideoPlayer } from "@videosdk.live/react-sdk";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface ParticipantViewProps {
  participantId: string;
  audioOnly?: boolean;
  speakerDeviceId?: string;
  volumeBoost?: number;
}

const ParticipantView = ({
  participantId,
  audioOnly = false,
  speakerDeviceId,
  volumeBoost = 1.0,
}: ParticipantViewProps) => {
  const micRef = useRef<HTMLAudioElement>(null);
  const { micStream, webcamOn, micOn, isLocal, displayName } =
    useParticipant(participantId);

  const attachedTrackIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const cleanupAudioNodes = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try { gainNodeRef.current.disconnect(); } catch (e) {}
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
      (el as any).setSinkId(speakerDeviceId)
        .then(() => {
          console.log(`[AudioRouting] Routed participant ${participantId} audio to device ${speakerDeviceId}`);
        })
        .catch((err: any) => {
          console.error(`[AudioRouting] Failed to setSinkId to ${speakerDeviceId}:`, err);
        });
    }
  }, [speakerDeviceId, isLocal, participantId]);

  useEffect(() => {
    const el = micRef.current;
    if (!el) return;

    // Prevent playing back local participant's own microphone track to themselves,
    // which causes feedback loops/howling and echoing delays on mobile speakers/mics.
    if (isLocal) {
      el.srcObject = null;
      attachedTrackIdRef.current = null;
      cleanupAudioNodes();
      return;
    }

    if (micOn && micStream?.track) {
      const trackId = micStream.track.id;
      // Avoid tearing down and re-attaching the same track on every render
      if (
        attachedTrackIdRef.current === trackId &&
        el.srcObject &&
        gainNodeRef.current &&
        gainNodeRef.current.gain.value === volumeBoost
      ) {
        return;
      }

      cleanupAudioNodes();

      const mediaStream = new MediaStream();
      mediaStream.addTrack(micStream.track);

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
          console.log(`[AudioRouting] Applied volume boost (${volumeBoost}x) to remote stream`);
        } catch (err) {
          console.error("[AudioRouting] Web Audio boost failed, falling back to raw stream:", err);
          el.srcObject = mediaStream;
        }
      } else {
        el.srcObject = mediaStream;
      }

      attachedTrackIdRef.current = trackId;

      // Apply output device if set
      if (speakerDeviceId && typeof (el as any).setSinkId === "function") {
        (el as any).setSinkId(speakerDeviceId).catch((err: any) => {
          console.error("[AudioRouting] Failed to set sinkId on start:", err);
        });
      }

      el.play().catch((error) => console.error("Audio play failed", error));
    } else {
      el.srcObject = null;
      attachedTrackIdRef.current = null;
      cleanupAudioNodes();
    }
  }, [micStream, micOn, isLocal, volumeBoost, speakerDeviceId, cleanupAudioNodes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioNodes();
    };
  }, [cleanupAudioNodes]);

  const showVideo = !audioOnly && webcamOn;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-muted border border-border">
      {showVideo ? (
        <VideoPlayer
          participantId={participantId}
          type="video"
          containerStyle={{
            height: "100%",
            width: "100%",
            aspectRatio: "16/9",
          }}
          className="h-full w-full"
          classNameVideo="h-full w-full object-cover"
          videoStyle={{}}
        />
      ) : (
        <div className="aspect-video flex items-center justify-center bg-muted">
          <div className="w-20 h-20 rounded-full bg-gradient-eternia flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground font-display">
              {(displayName || "U").charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Overlay info */}
      <div className={`absolute bottom-0 left-0 right-0 ${isLocal ? 'p-1.5 bg-black/45' : 'p-3 bg-gradient-to-t from-background/80 to-transparent'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className={`font-medium text-foreground truncate ${isLocal ? 'text-[10px] max-w-[65%]' : 'text-sm'}`}>
            {displayName || "Participant"} {isLocal && "(You)"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {micOn ? (
              <Mic className={`${isLocal ? 'w-3 h-3' : 'w-4 h-4'} text-primary`} />
            ) : (
              <MicOff className={`${isLocal ? 'w-3 h-3' : 'w-4 h-4'} text-destructive`} />
            )}
            {!audioOnly && (
              webcamOn ? (
                <Video className={`${isLocal ? 'w-3 h-3' : 'w-4 h-4'} text-primary`} />
              ) : (
                <VideoOff className={`${isLocal ? 'w-3 h-3' : 'w-4 h-4'} text-destructive`} />
              )
            )}
          </div>
        </div>
      </div>

      <audio ref={micRef} autoPlay playsInline muted={isLocal} />
    </div>
  );
};

export default ParticipantView;
