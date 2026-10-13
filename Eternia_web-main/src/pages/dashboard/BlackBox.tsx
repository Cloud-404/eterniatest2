import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { Loader2, Phone, X, Mic, MicOff, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import NovaOrb from "@/components/blackbox/NovaOrb";
import { motion, AnimatePresence } from "framer-motion";

const LazyMeetingProvider = lazy(() => import("@videosdk.live/react-sdk").then(m => ({ default: m.MeetingProvider })));
const LazyMeetingView = lazy(() => import("@/components/videosdk/MeetingView"));
import { useBlackBoxSession } from "@/hooks/useBlackBoxSession";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileBlackBox from "@/components/mobile/MobileBlackBox";

const SESSION_MESSAGES = [
  "Hi, This is your anonymous space.",
  "Take your time. I'm here.",
  "You're not alone in this.",
  "I'm listening...",
];

const BlackBox = () => {
  const isMobile = useIsMobile();
  const {
    activeSession, isRequesting, callState, token,
    requestSession, cancelSession, endSession, retryConnection,
    fetchToken, onCallJoined, onCallError,
  } = useBlackBoxSession();
  const { user, profile } = useAuth();

  const [toggleMicFn, setToggleMicFn] = useState<(() => void) | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [entryPhase, setEntryPhase] = useState<"blank" | "greeting" | "ready">("blank");
  const [sessionMsgIdx, setSessionMsgIdx] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const handleToggleMicReady = useCallback((fn: () => void) => { setToggleMicFn(() => fn); }, []);
  const handleMicStatusChange = useCallback((on: boolean) => { setMicOn(on); }, []);

  const isIdle = callState === "idle" && !activeSession && !isRequesting;
  const isQueued = callState === "waiting";
  const isReady = callState === "ready";
  const isJoining = callState === "joining";
  const isFailed = callState === "failed";
  const isJoined = callState === "joined" && !!token && !!activeSession?.room_id;



  // Entry sequence
  useEffect(() => {
    if (!isIdle) { setEntryPhase("ready"); return; }
    setEntryPhase("blank");
    const t1 = setTimeout(() => setEntryPhase("greeting"), 2000);
    const t2 = setTimeout(() => setEntryPhase("ready"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isIdle]);

  // Session message cycling
  useEffect(() => {
    if (!isJoined) { setSessionMsgIdx(0); return; }
    const iv = setInterval(() => {
      setSessionMsgIdx(i => (i + 1) % SESSION_MESSAGES.length);
    }, 6000);
    return () => clearInterval(iv);
  }, [isJoined]);

  // Update message on voice activity
  useEffect(() => {
    if (isJoined && audioLevel > 0.15) setSessionMsgIdx(3); // "I'm listening..."
  }, [isJoined, audioLevel > 0.15]);

  if (isMobile) return <MobileBlackBox />;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-lg">
        <AnimatePresence mode="wait">
          {isIdle && entryPhase === "blank" && (
            <motion.div key="blank" className="h-8" />
          )}

          {isIdle && entryPhase === "greeting" && (
            <motion.p
              key="greeting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-lg text-foreground/70 font-display"
            >
              Hi, This is your anonymous space.
            </motion.p>
          )}

          {(entryPhase === "ready" || !isIdle) && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-6"
            >
              <NovaOrb
                isActive={isJoined}
                isPulsing={isQueued || isRequesting || isJoining}
                size={260}
                audioLevel={audioLevel}
              />

              {/* Status pills */}
              {isJoining && (
                <div className="px-5 py-2 rounded-full border border-border bg-card/60 backdrop-blur text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…
                </div>
              )}
              {isFailed && (
                <div className="flex flex-col items-center gap-2">
                  <div className="px-5 py-2 rounded-full border border-destructive/30 bg-destructive/10 text-sm text-destructive">Connection failed</div>
                  {activeSession?.last_join_error && (
                    <p className="text-xs text-muted-foreground max-w-xs text-center">{activeSession.last_join_error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={retryConnection}><RefreshCw className="w-3.5 h-3.5" /> Retry</Button>
                    <Button variant="ghost" size="sm" onClick={cancelSession}>Cancel</Button>
                  </div>
                </div>
              )}
              {isReady && (
                <div className="px-5 py-2 rounded-full border border-border bg-card/60 backdrop-blur text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Therapist found — connecting…
                </div>
              )}
              {isQueued && (
                <button onClick={cancelSession} className="px-5 py-2 rounded-full border border-border bg-card/60 backdrop-blur text-sm text-muted-foreground hover:bg-card transition-colors">
                  Waiting for therapist… Tap to cancel
                </button>
              )}

              {/* Dynamic text */}
              <div className="text-center px-6 max-w-md h-16 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {isJoined ? (
                    <motion.p
                      key={`msg-${sessionMsgIdx}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.5 }}
                      className="text-lg font-display text-foreground/80"
                    >
                      {SESSION_MESSAGES[sessionMsgIdx]}
                    </motion.p>
                  ) : isReady || isJoining ? (
                    <motion.p key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-base text-muted-foreground">
                      Setting up secure connection…
                    </motion.p>
                  ) : isQueued ? (
                    <motion.p key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-base text-muted-foreground">
                      You're in the queue. A professional will connect shortly.
                    </motion.p>
                  ) : isFailed ? (
                    <motion.p key="fail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-base text-muted-foreground">
                      Could not connect. Please retry or cancel.
                    </motion.p>
                  ) : (
                    <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
                      Connect anonymously with a professional — 24/7 support.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden meeting provider */}
      {!!token && !!activeSession?.room_id && callState !== "idle" && (
        <div
          key={`${activeSession.id}-${activeSession.room_id}`}
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0, zIndex: -1 }}
          aria-hidden="true"
        >
          <Suspense fallback={null}>
            <LazyMeetingProvider
              config={{ meetingId: activeSession.room_id, micEnabled: true, webcamEnabled: false, name: profile?.username || "Anonymous", participantId: profile?.id || user?.id, debugMode: false }}
              token={token}
              joinWithoutUserInteraction={false}
            >
              <LazyMeetingView
                meetingId={activeSession.room_id} onMeetingLeave={endSession} audioOnly sessionId={activeSession.id}
                enableMonitoring={false} autoJoin onJoined={onCallJoined} onJoinError={onCallError}
                hideControls onToggleMicReady={handleToggleMicReady} onMicStatusChange={handleMicStatusChange}
                onAudioLevelChange={setAudioLevel}
              />
            </LazyMeetingProvider>
          </Suspense>
        </div>
      )}

      {/* Bottom controls */}
      <div className="py-8 flex items-center justify-center gap-4">
        <AnimatePresence mode="wait">
          {isJoined ? (
            <motion.div key="session-ctrl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-full w-14 h-14 bg-muted/30 border-border"><Video className="w-5 h-5 text-muted-foreground" /></Button>
              <Button variant="outline" size="icon"
                className={`rounded-full w-16 h-16 ${micOn ? "bg-accent/20 border-accent/30" : "bg-destructive/20 border-destructive/30"}`}
                onClick={() => toggleMicFn?.()}
              >
                {micOn ? <Mic className="w-6 h-6 text-accent" /> : <MicOff className="w-6 h-6 text-destructive" />}
              </Button>
              <Button variant="destructive" size="icon" className="rounded-full w-14 h-14" onClick={endSession}><X className="w-6 h-6" /></Button>
            </motion.div>
          ) : isQueued || isFailed ? (
            <motion.div key="cancel-ctrl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button variant="destructive" size="lg" className="rounded-full px-8 gap-2" onClick={cancelSession}><X className="w-5 h-5" /> Cancel</Button>
            </motion.div>
          ) : isReady || isJoining ? null : entryPhase === "ready" ? (
            <motion.div key="call-ctrl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Button size="lg" className="rounded-full px-8 gap-2 h-14 text-base" disabled={isRequesting} onClick={requestSession}>
                {isRequesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                Request Voice Call
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BlackBox;
