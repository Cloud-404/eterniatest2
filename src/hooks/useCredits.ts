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
      if (creditBalance < amount) throw new Error("Insufficient credits");

      const { error } = await supabase.from("credit_transactions").insert({
        user_id: user.id,
        delta: -amount,
        type: "spend",
        notes,
      });

      if (error) throw error;
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

      const { error } = await supabase.from("credit_transactions").insert({
        user_id: user.id,
        delta: amount,
        type: "earn",
        notes,
      });

      if (error) throw error;
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
