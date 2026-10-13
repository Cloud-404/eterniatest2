import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEccEarn } from "@/hooks/useEccEarn";

export interface QuestCard {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  category: string | null;
  is_active: boolean;
}

export interface QuestCompletion {
  id: string;
  user_id: string;
  quest_id: string;
  completed_date: string;
  completed_at: string;
  answer: string | null;
}

export function useQuests() {
  const { user, refreshCredits } = useAuth();
  const queryClient = useQueryClient();
  const { remainingThisWeek, canEarn } = useEccEarn();

  const { data: quests = [], isLoading: isLoadingQuests, error: questsError } = useQuery({
    queryKey: ["quest-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_cards")
        .select("id, title, description, xp_reward, category, is_active")
        .eq("is_active", true)
        .order("xp_reward", { ascending: false });

      if (error) throw error;
      return data as QuestCard[];
    },
    retry: 1,
  });

  const { data: completions = [], isLoading: isLoadingCompletions, error: completionsError } = useQuery({
    queryKey: ["quest-completions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("quest_completions")
        .select("id, user_id, quest_id, completed_date, completed_at, answer")
        .eq("user_id", user.id)
        .eq("completed_date", today);

      if (error) throw error;
      return data as QuestCompletion[];
    },
    enabled: !!user,
    retry: 1,
  });

  const completeQuest = useMutation({
    mutationFn: async ({ quest, answer }: { quest: QuestCard; answer: string }) => {
      if (!user) throw new Error("Not authenticated");

      const alreadyCompleted = completions.some(c => c.quest_id === quest.id);
      if (alreadyCompleted) {
        throw new Error("Quest already completed today");
      }

      const actualReward = Math.min(2, remainingThisWeek);
      if (!canEarn || actualReward <= 0) {
        const { error: completionError } = await supabase.from("quest_completions").insert({
          user_id: user.id,
          quest_id: quest.id,
          answer,
        });
        if (completionError) throw completionError;
        return { ...quest, xp_reward: 0 };
      }

      const { error: completionError } = await supabase.from("quest_completions").insert({
        user_id: user.id,
        quest_id: quest.id,
        answer,
      });
      if (completionError) throw completionError;

      const { error: creditError } = await supabase.from("credit_transactions").insert({
        user_id: user.id,
        delta: actualReward,
        type: "earn",
        notes: `Quest completed: ${quest.title}`,
        reference_id: quest.id,
      });
      if (creditError) throw creditError;

      return { ...quest, xp_reward: actualReward };
    },
    onSuccess: (quest) => {
      queryClient.invalidateQueries({ queryKey: ["quest-completions"] });
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
      refreshCredits();
      toast.success(`+${quest.xp_reward} XP earned!`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const totalXpToday = completions.reduce((sum, c) => {
    const quest = quests.find(q => q.id === c.quest_id);
    return sum + (quest?.xp_reward || 0);
  }, 0);

  return {
    quests,
    completions,
    isLoading: isLoadingQuests || isLoadingCompletions,
    error: questsError || completionsError,
    completeQuest: (args: { quest: QuestCard; answer: string }) => completeQuest.mutate(args),
    isCompleting: completeQuest.isPending,
    completedToday: completions.length,
    totalXpToday,
  };
}
