import { useIsMobile } from "@/hooks/use-mobile";
import MobileSoundTherapy from "@/components/mobile/MobileSoundTherapy";

import { useState, useCallback, useEffect, useRef } from "react";
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Clock, Headphones, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useSoundTherapy } from "@/hooks/useSoundTherapy";
import { useEccEarn } from "@/hooks/useEccEarn";
import { supabase } from "@/integrations/supabase/client";

const SoundTherapy = () => {
  const isMobile = useIsMobile();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [volume, setVolume] = useState([75]);
  const [progress, setProgress] = useState([0]);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { tracks, categories, isLoading, formatDuration } = useSoundTherapy();
  const { earnFromActivity, canEarn } = useEccEarn();
  const earnedForTrackRef = useRef<Set<string>>(new Set());
  const filteredTracks = activeCategory === "all" ? tracks : tracks.filter((t) => t.category === activeCategory);
  const currentTrackData = filteredTracks[currentTrack];
  const currentTrackRef = useRef(currentTrackData);
  currentTrackRef.current = currentTrackData;

  useEffect(() => {
    if (currentTrackData?.file_url && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(currentTrackData.file_url);
      audioRef.current.volume = isMuted ? 0 : volume[0] / 100;
      audioRef.current.play().catch(() => {});
      const audio = audioRef.current;
      const updateProgress = () => { if (audio.duration) setProgress([(audio.currentTime / audio.duration) * 100]); };
      audio.addEventListener("timeupdate", updateProgress);
      audio.addEventListener("ended", () => {
        const track = currentTrackRef.current;
        // Earn ECC on full track listen
        if (track && canEarn && !earnedForTrackRef.current.has(track.id)) {
          earnedForTrackRef.current.add(track.id);
          earnFromActivity({ amount: 1, activity: `Listened to: ${track.title}` });
        }
        // Atomic play count increment
        if (track) {
          supabase.rpc("increment_play_count", { _track_id: track.id }).then(() => {});
        }
        handleNext();
      });
      return () => { audio.removeEventListener("timeupdate", updateProgress); audio.pause(); };
    } else if (!isPlaying && audioRef.current) { audioRef.current.pause(); }
  }, [currentTrack, isPlaying, currentTrackData?.file_url]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume[0] / 100; }, [volume, isMuted]);

  const handleTrackSelect = useCallback((index: number) => {
    if (!filteredTracks[index]?.file_url) { toast({ title: "No audio file", description: "This track has no audio file yet", variant: "destructive" }); return; }
    setCurrentTrack(index); setIsPlaying(true); setProgress([0]);
  }, [filteredTracks]);
  const handleSeek = useCallback((val: number[]) => { if (audioRef.current?.duration) audioRef.current.currentTime = (val[0] / 100) * audioRef.current.duration; }, []);
  const filteredTracksRef = useRef(filteredTracks);
  filteredTracksRef.current = filteredTracks;
  const handleNext = useCallback(() => { setCurrentTrack((prev) => prev + 1 < filteredTracksRef.current.length ? (setProgress([0]), prev + 1) : prev); }, []);
  const handlePrev = useCallback(() => { setCurrentTrack((prev) => prev > 0 ? (setProgress([0]), prev - 1) : prev); }, []);
  const toggleMute = useCallback(() => setIsMuted((prev) => !prev), []);

  if (isMobile) return <MobileSoundTherapy />;

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold font-display">Sound Therapy</h1>
          <p className="text-sm text-muted-foreground">Curated audio for meditation & focus</p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button onClick={() => setActiveCategory("all")} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
          ))}
        </div>

        {filteredTracks.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No sounds yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sounds will be added by your admin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-2">
              {filteredTracks.map((track, index) => {
                const isActive = currentTrack === index && isPlaying;
                return (
                  <button key={track.id} onClick={() => handleTrackSelect(index)}
                    className={`w-full p-3.5 rounded-xl text-left transition-all flex items-center gap-3 ${isActive ? "bg-primary/10 border-primary/50" : "bg-card hover:bg-muted/40"} border border-border/50`}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xl shrink-0">{(track.cover_emoji || "🎵").slice(0, 2)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{track.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{track.artist || "Unknown"}</span><span>·</span>
                        <span className="shrink-0 flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(track.duration_sec)}</span>
                        {!track.file_url && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">No audio</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isActive ? <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Pause className="w-3.5 h-3.5 text-primary-foreground" /></div>
                        : <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center"><Play className="w-3.5 h-3.5 ml-0.5" /></div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Now Playing */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 p-5 rounded-2xl bg-card border border-border/50">
                <div className="text-center mb-5">
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-4xl mx-auto mb-3">{(currentTrackData?.cover_emoji || "🎵").slice(0, 2)}</div>
                  <h3 className="font-semibold text-sm">{currentTrackData?.title || "Select a track"}</h3>
                  <p className="text-xs text-muted-foreground">{currentTrackData?.artist || ""}</p>
                </div>
                <div className="mb-4">
                  <Slider value={progress} onValueChange={setProgress} onValueCommit={handleSeek} max={100} step={1} className="mb-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{currentTrackData ? formatDuration(Math.floor((progress[0] / 100) * (currentTrackData.duration_sec || 0))) : "0:00"}</span>
                    <span>{currentTrackData ? formatDuration(currentTrackData.duration_sec) : "0:00"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 mb-5">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrev}><SkipBack className="w-4 h-4" /></Button>
                  <Button size="icon" className="w-12 h-12 rounded-full bg-primary text-primary-foreground" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNext}><SkipForward className="w-4 h-4" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
                    {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Slider value={isMuted ? [0] : volume} onValueChange={setVolume} max={100} step={1} className="flex-1" />
                </div>
                <div className="mt-4 p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" />Use headphones for best experience</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SoundTherapy;
