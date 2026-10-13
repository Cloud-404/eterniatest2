import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Loader2, ChevronDown, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useSoundTherapy } from "@/hooks/useSoundTherapy";
import { useEccEarn } from "@/hooks/useEccEarn";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const surfaces = [
  "surface-mint", "surface-sky", "surface-lavender",
  "surface-pink", "surface-butter", "surface-peach",
];

// Animated CSS waveform — reacts to playing state
const Waveform = ({ active }: { active: boolean }) => (
  <div className="flex items-end justify-center gap-[3px] h-14 w-full">
    {Array.from({ length: 32 }).map((_, i) => (
      <span
        key={i}
        className="w-[3px] rounded-full bg-foreground/70 origin-bottom"
        style={{
          height: `${20 + Math.abs(Math.sin(i * 0.6)) * 80}%`,
          animation: active ? `wave-bar 1s ease-in-out ${i * 0.04}s infinite` : "none",
          opacity: active ? 1 : 0.35,
        }}
      />
    ))}
  </div>
);

// Lotus/circle illustration — CSS only
const MeditationIllustration = ({ surface }: { surface: string }) => (
  <div className="relative w-56 h-56 mx-auto">
    <div className={`absolute inset-0 rounded-full ${surface} animate-pulse-glow`} />
    <div className={`absolute inset-6 rounded-full ${surface} opacity-70`} />
    <div className={`absolute inset-12 rounded-full ${surface} opacity-90`} />
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-6xl">🧘‍♀️</span>
    </div>
    {/* orbit dots */}
    {[0, 60, 120, 180, 240, 300].map((deg) => (
      <span
        key={deg}
        className="absolute w-2 h-2 rounded-full bg-foreground/30"
        style={{
          top: "50%",
          left: "50%",
          transform: `rotate(${deg}deg) translate(7rem) rotate(-${deg}deg)`,
        }}
      />
    ))}
  </div>
);

const MobileSoundTherapy = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [volume, setVolume] = useState([75]);
  const [progress, setProgress] = useState([0]);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [showExpanded, setShowExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { tracks, categories, isLoading, formatDuration } = useSoundTherapy();
  const { earnFromActivity, canEarn } = useEccEarn();
  const earnedForTrackRef = useRef<Set<string>>(new Set());
  const filteredTracks = activeCategory === "all" ? tracks : tracks.filter((t) => t.category === activeCategory);
  const currentTrackData = filteredTracks[currentTrack];

  useEffect(() => {
    if (currentTrackData?.file_url && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(currentTrackData.file_url);
      audioRef.current.volume = isMuted ? 0 : volume[0] / 100;
      audioRef.current.play().catch(() => {});
      const audio = audioRef.current;
      const update = () => { if (audio.duration) setProgress([(audio.currentTime / audio.duration) * 100]); };
      audio.addEventListener("timeupdate", update);
      audio.addEventListener("ended", () => {
        if (currentTrackData && canEarn && !earnedForTrackRef.current.has(currentTrackData.id)) {
          earnedForTrackRef.current.add(currentTrackData.id);
          earnFromActivity({ amount: 1, activity: `Listened to: ${currentTrackData.title}` });
        }
        if (currentTrackData) {
          supabase.rpc("increment_play_count", { _track_id: currentTrackData.id }).then(() => {});
        }
        handleNext();
      });
      return () => { audio.removeEventListener("timeupdate", update); audio.pause(); };
    } else if (!isPlaying && audioRef.current) { audioRef.current.pause(); }
  }, [currentTrack, isPlaying, currentTrackData?.file_url]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume[0] / 100; }, [volume, isMuted]);

  const handleTrackSelect = useCallback((i: number) => {
    if (!filteredTracks[i]?.file_url) { toast({ title: "No audio file", description: "This track has no audio file yet", variant: "destructive" }); return; }
    setCurrentTrack(i); setIsPlaying(true); setProgress([0]);
  }, [filteredTracks]);
  const handleSeek = useCallback((val: number[]) => { if (audioRef.current?.duration) audioRef.current.currentTime = (val[0] / 100) * audioRef.current.duration; }, []);
  const handleNext = useCallback(() => { setCurrentTrack((p) => p + 1 < filteredTracks.length ? (setProgress([0]), p + 1) : p); }, [filteredTracks.length]);
  const handlePrev = useCallback(() => { setCurrentTrack((p) => p > 0 ? (setProgress([0]), p - 1) : p); }, []);

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  const hasPlayer = !!currentTrackData;
  const surface = surfaces[currentTrack % surfaces.length];

  const elapsed = formatDuration(Math.floor((progress[0] / 100) * (currentTrackData?.duration_sec || 0)));
  const total = formatDuration(currentTrackData?.duration_sec);

  const expandedPlayer = showExpanded && currentTrackData
    ? createPortal(
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="relative z-10 flex flex-col flex-1 w-full px-5">
            {/* Top bar */}
            <div className="flex items-center justify-between py-4">
              <button onClick={() => setShowExpanded(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border/50 shadow-soft">
                <ChevronDown className="w-5 h-5" />
              </button>
              <span className="pill"><Sparkles className="w-3 h-3" /> Powered by AI</span>
              <div className="w-10" />
            </div>

            {/* Title block */}
            <div className="text-center mt-2 mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Meditation</p>
              <h1 className="text-3xl font-display font-semibold mt-1 leading-tight">
                {currentTrackData.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Stress Relaxation</p>
            </div>

            {/* Illustration */}
            <div className="flex-1 flex items-center justify-center">
              <MeditationIllustration surface={surface} />
            </div>

            {/* Waveform + timer */}
            <div className="space-y-4 pb-2">
              <div className="card-soft p-4">
                <Waveform active={isPlaying} />
                <Slider value={progress} onValueChange={setProgress} onValueCommit={handleSeek} max={100} step={0.5} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>{elapsed}</span>
                  <span>{total}</span>
                </div>
              </div>

              {/* Controls — circular play + skip pills */}
              <div className="flex items-center justify-center gap-6 pb-4">
                <button onClick={handlePrev} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-soft active:scale-95">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-20 h-20 rounded-full bg-foreground text-background flex items-center justify-center shadow-soft-lg active:scale-95 transition"
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>
                <button onClick={handleNext} className="w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-soft active:scale-95">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 px-2 pb-2">
                <button onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
                </button>
                <Slider value={isMuted ? [0] : volume} onValueChange={setVolume} max={100} step={1} className="flex-1" />
              </div>
            </div>
          </div>
        </motion.div>,
        document.body
      )
    : null;

  return (
    <DashboardLayout>
      <AnimatePresence>{expandedPlayer}</AnimatePresence>
      <div className="w-full space-y-5 pb-28 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold">Sound Therapy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Curated audio for healing & focus</p>
          </div>
          <span className="pill"><Sparkles className="w-3 h-3" /> AI</span>
        </div>

        {/* Categories — pill row */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === "all" ? "bg-foreground text-background" : "bg-card border border-border/50 text-foreground/70"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat ? "bg-foreground text-background" : "bg-card border border-border/50 text-foreground/70"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Track list */}
        {filteredTracks.length === 0 ? (
          <div className="text-center py-16 card-soft">
            <Music className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No tracks yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Your admin will add sounds here</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTracks.map((track, index) => {
              const isActive = currentTrack === index && isPlaying;
              const tileSurface = surfaces[index % surfaces.length];
              return (
                <button
                  key={track.id}
                  onClick={() => handleTrackSelect(index)}
                  className={`w-full flex items-center gap-3 p-3 rounded-3xl text-left transition-all shadow-soft ${
                    isActive ? "bg-card border-2 border-accent/40" : "bg-card border border-border/40"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl ${tileSurface} flex items-center justify-center shrink-0 relative`}>
                    <span className="text-xl">{(track.cover_emoji || "🎵").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-display font-semibold truncate ${isActive ? "text-accent" : ""}`}>{track.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {track.artist || "Unknown"} · {formatDuration(track.duration_sec)}
                      {!track.file_url && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive ml-1">No audio</span>}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mini Player */}
      {hasPlayer && !showExpanded && (
        <div
          className="fixed left-0 right-0 z-40 px-3"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={() => setShowExpanded(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-card rounded-full border border-border/60 shadow-soft-lg"
          >
            <div className={`w-10 h-10 rounded-full ${surface} flex items-center justify-center text-base shrink-0`}>
              {(currentTrackData.cover_emoji || "🎵").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-display font-semibold truncate">{currentTrackData.title}</p>
              <div className="h-[2px] mt-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress[0]}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
            </div>
          </button>
        </div>
      )}
    </DashboardLayout>
  );
};

export default MobileSoundTherapy;
