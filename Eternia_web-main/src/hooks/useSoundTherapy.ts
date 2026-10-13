import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface SoundTrack {
  id: string;
  title: string;
  artist: string | null;
  category: string;
  description: string | null;
  duration_sec: number | null;
  cover_emoji: string | null;
  file_url: string | null;
  is_active: boolean;
  play_count: number;
}

export function useSoundTherapy() {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["sound-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sound_content")
        .select("id, title, artist, category, description, duration_sec, cover_emoji, file_url, is_active, play_count")
        .eq("is_active", true)
        .order("play_count", { ascending: false });

      if (error) throw error;
      return data as SoundTrack[];
    },
  });

  const categories = Array.from(new Set(tracks.map((t) => t.category)));

  const getTracksByCategory = (category: string) =>
    tracks.filter((t) => t.category === category);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    tracks,
    categories,
    isLoading,
    getTracksByCategory,
    formatDuration,
  };
}
