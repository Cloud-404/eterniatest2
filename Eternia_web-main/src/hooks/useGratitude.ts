import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useGratitude() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["gratitude-entries", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("gratitude_entries")
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

  const addEntry = useMutation({
    mutationFn: async ({ entry_1, entry_2, entry_3 }: { entry_1: string; entry_2: string; entry_3: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("gratitude_entries")
        .insert({ user_id: user.id, entry_1, entry_2, entry_3 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gratitude-entries"] });
      toast.success("Gratitude saved 🙏");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    entries,
    isLoading,
    todayEntry,
    addEntry: addEntry.mutate,
    isAdding: addEntry.isPending,
  };
}
