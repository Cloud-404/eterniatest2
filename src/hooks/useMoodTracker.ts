import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMoodTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["mood-entries", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("mood_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const todayEntry = entries.find(
    (e) => new Date(e.created_at).toDateString() === new Date().toDateString()
  );

  const logMood = useMutation({
    mutationFn: async ({ mood, note }: { mood: number; note?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("mood_entries")
        .insert({ user_id: user.id, mood, note: note || "" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood-entries"] });
      toast.success("Mood logged 🎭");
    },
    onError: (e) => toast.error(e.message),
  });

  // Last 7 days for chart
  const last7Days = entries
    .filter((e) => {
      const d = new Date(e.created_at);
      const now = new Date();
      return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    })
    .reverse();

  return {
    entries,
    isLoading,
    todayEntry,
    logMood: logMood.mutate,
    isLogging: logMood.isPending,
    last7Days,
  };
}
