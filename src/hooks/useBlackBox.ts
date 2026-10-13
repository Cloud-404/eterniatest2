import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface BlackBoxEntry {
  id: string;
  user_id: string;
  content_encrypted: string;
  content_type: "text" | "voice";
  ai_flag_level: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 30;

export function useBlackBox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hasMore, setHasMore] = useState(true);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["blackbox-entries", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("blackbox_entries")
        .select("id, user_id, content_encrypted, content_type, ai_flag_level, is_private, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      setHasMore((data?.length || 0) >= PAGE_SIZE);
      return data as BlackBoxEntry[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const loadMore = useCallback(async () => {
    if (!user || entries.length === 0 || !hasMore) return;
    const oldest = entries[entries.length - 1];
    const { data, error } = await supabase
      .from("blackbox_entries")
      .select("id, user_id, content_encrypted, content_type, ai_flag_level, is_private, created_at, updated_at")
      .eq("user_id", user.id)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) { console.error(error); return; }
    if ((data?.length || 0) < PAGE_SIZE) setHasMore(false);
    if (data && data.length > 0) {
      queryClient.setQueryData(["blackbox-entries", user.id], [...entries, ...data]);
    }
  }, [user, entries, hasMore, queryClient]);

  const createEntry = useMutation({
    mutationFn: async ({ content, isPrivate }: { content: string; isPrivate: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.from("blackbox_entries").insert({
        user_id: user.id,
        content_encrypted: content,
        content_type: "text",
        is_private: isPrivate,
        ai_flag_level: 0,
      }).select("id").single();

      if (error) throw error;

      if (data?.id && !isPrivate) {
        supabase.functions.invoke("ai-moderate", {
          body: { content, entry_id: data.id },
        }).catch((err) => console.warn("AI moderation failed:", err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blackbox-entries"] });
      toast.success("Entry saved securely");
    },
    onError: (error) => {
      toast.error("Failed to save entry");
      console.error(error);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("blackbox_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blackbox-entries"] });
      toast.success("Entry deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete entry");
      console.error(error);
    },
  });

  return {
    entries,
    isLoading,
    hasMore,
    loadMore,
    createEntry: createEntry.mutate,
    deleteEntry: deleteEntry.mutate,
    isCreating: createEntry.isPending,
    isDeleting: deleteEntry.isPending,
  };
}
