import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface CreditTransaction {
  id: string;
  user_id: string;
  delta: number;
  type: "earn" | "spend" | "grant" | "purchase";
  notes: string | null;
  created_at: string;
}

import { spendCredits as invokeSpendCredits } from "./useSpendCredits";

export function useCredits() {
  const { user, creditBalance, refreshCredits } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["credit-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("id, user_id, delta, type, notes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  const spendCredits = useMutation({
    mutationFn: async ({ amount, notes }: { amount: number; notes: string }) => {
      if (!user) throw new Error("Not authenticated");
      const result = await invokeSpendCredits(amount, notes);
      if (!result.success) {
        throw new Error(result.error || "Insufficient credits");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
      refreshCredits();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const earnCredits = useMutation({
    mutationFn: async ({ amount, notes }: { amount: number; notes: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("earn_credits_activity", {
        _amount: Math.min(Math.max(1, Math.round(amount)), 5),
        _activity: notes,
      });

      if (error) throw error;
      const res = data?.[0];
      if (!res || !res.success) {
        throw new Error(res?.message || "Failed to earn credits");
      }
      return res.earned;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
      refreshCredits();
      toast.success("Credits earned!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    balance: creditBalance,
    transactions,
    isLoadingTransactions,
    spendCredits: spendCredits.mutate,
    earnCredits: earnCredits.mutate,
    isSpending: spendCredits.isPending,
    isEarning: earnCredits.isPending,
  };
}
