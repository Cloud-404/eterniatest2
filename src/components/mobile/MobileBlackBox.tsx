import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Phone, X, Mic, MicOff, Video, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useBlackBoxSession } from "@/hooks/useBlackBoxSession";
import { useAuth } from "@/contexts/AuthContext";
import NovaOrb from "@/components/blackbox/NovaOrb";

const MeetingProvider = lazy(() => import("@videosdk.live/react-sdk").then(m => ({ default: m.MeetingProvider })));
const MeetingView = lazy(() => import("@/components/videosdk/MeetingView"));

const SESSION_MESSAGES = [
  "Hi, This is your anonymous space.",
  "Take your time. I'm here.",
  "You're not alone in this.",
  "I'm listening...",
];

const MobileBlackBox = () => {
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



  useEffect(() => {
    if (!isIdle) { setEntryPhase("ready"); return; }
    setEntryPhase("blank");
    const t1 = setTimeout(() => setEntryPhase("greeting"), 2000);
    const t2 = setTimeout(() => setEntryPhase("ready"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isIdle]);

  useEffect(() => {
    if (!isJoined) { setSessionMsgIdx(0); return; }
    const iv = setInterval(() => setSessionMsgIdx(i => (i + 1) % SESSION_MESSAGES.length), 6000);
    return () => clearInterval(iv);
  }, [isJoined]);

  useEffect(() => {
    if (isJoined && audioLevel > 0.15) setSessionMsgIdx(3);
  }, [isJoined, audioLevel > 0.15]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full px-6">
        <AnimatePresence mode="wait">
          {isIdle && entryPhase === "blank" && <motion.div key="blank" className="h-6" />}

          {isIdle && entryPhase === "greeting" && (
            <motion.p key="greeting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
              className="text-base text-foreground/70 font-display text-center">
              Hi, This is your anonymous space.
            </motion.p>
          )}

          {(entryPhase === "ready" || !isIdle) && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-5">
              <NovaOrb isActive={isJoined} isPulsing={isQueued || isRequesting || isJoining} size={200} audioLevel={audioLevel} />

              {isJoining && (
                <div className="px-4 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Connecting…
                </div>
              )}
              {isFailed && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="px-4 py-1.5 rounded-full border border-destructive/30 bg-destructive/10 text-xs text-destructive">Connection failed</div>
                  {activeSession?.last_join_error && (
                    <p className="text-[10px] text-muted-foreground max-w-[200px] text-center">{activeSession.last_join_error}</p>
                  )}
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={retryConnection}><RefreshCw className="w-3 h-3" /> Retry</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={cancelSession}>Cancel</Button>
                  </div>
                </div>
              )}
              {isReady && (
                <div className="px-4 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Therapist found — connecting…
                </div>
              )}
              {isQueued && (
                <button onClick={cancelSession} className="px-4 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs text-muted-foreground">
                  Waiting for therapist…
                </button>
              )}

              <div className="text-center max-w-xs h-12 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {isJoined ? (
                    <motion.p key={`msg-${sessionMsgIdx}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.5 }} className="text-base font-display text-foreground/80">
                      {SESSION_MESSAGES[sessionMsgIdx]}
                    </motion.p>
                  ) : isQueued ? (
                    <motion.p key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
                      You're in the queue. A professional will connect shortly.
                    </motion.p>
                  ) : isIdle ? (
                    <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
                      Connect anonymously — 24/7 support.
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!!token && !!activeSession?.room_id && callState !== "idle" && (
        <Suspense fallback={null}>
          <div key={`${activeSession.id}-${activeSession.room_id}`}
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
            aria-hidden="true">
            <MeetingProvider
              config={{ meetingId: activeSession.room_id, micEnabled: true, webcamEnabled: false, name: profile?.username || "Anonymous", participantId: profile?.id || user?.id, debugMode: false }}
              token={token} joinWithoutUserInteraction={false}>
              <MeetingView meetingId={activeSession.room_id} onMeetingLeave={endSession} audioOnly sessionId={activeSession.id}
                enableMonitoring={false} autoJoin onJoined={onCallJoined} onJoinError={onCallError}
                hideControls onToggleMicReady={handleToggleMicReady} onMicStatusChange={handleMicStatusChange}
                onAudioLevelChange={setAudioLevel} />
            </MeetingProvider>
          </div>
        </Suspense>
      )}

      <div className="pb-8 pt-4 flex items-center justify-center gap-4">
        <AnimatePresence mode="wait">
          {isJoined ? (
            <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="rounded-full w-12 h-12 bg-muted/30 border-border"><Video className="w-5 h-5 text-muted-foreground" /></Button>
              <Button variant="outline" size="icon"
                className={`rounded-full w-14 h-14 ${micOn ? "bg-accent/20 border-accent/30" : "bg-destructive/20 border-destructive/30"}`}
                onClick={() => toggleMicFn?.()}>
                {micOn ? <Mic className="w-6 h-6 text-accent" /> : <MicOff className="w-6 h-6 text-destructive" />}
              </Button>
              <Button variant="destructive" size="icon" className="rounded-full w-12 h-12" onClick={endSession}><X className="w-5 h-5" /></Button>
            </motion.div>
          ) : isQueued || isFailed ? (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button variant="destructive" className="rounded-full px-6 gap-2" onClick={cancelSession}><X className="w-4 h-4" /> Cancel</Button>
            </motion.div>
          ) : isReady || isJoining ? null : entryPhase === "ready" ? (
            <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Button className="rounded-full px-6 gap-2 h-12" disabled={isRequesting} onClick={requestSession}>
                {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                Request Voice Call
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileBlackBox;
