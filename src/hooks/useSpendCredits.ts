import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface SpendResult {
  success: boolean;
  source?: "balance" | "pool";
  remaining?: number;
  error?: string;
}

const parseFunctionError = async (error: unknown): Promise<string> => {
  if (error instanceof FunctionsHttpError) {
    try {
      const raw = await error.context.text();
      const parsed = JSON.parse(raw) as { error?: string; details?: string; message?: string };
      return parsed.error || parsed.details || parsed.message || error.message || "Credit spend failed";
    } catch {
      return error.message || "Credit spend failed";
    }
  }

  if (error instanceof Error) return error.message;
  return "Credit spend failed";
};

export async function spendCredits(amount: number, notes?: string, referenceId?: string): Promise<SpendResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("spend-credits", {
    body: { amount, notes, reference_id: referenceId },
  });

  if (error) {
    const message = await parseFunctionError(error);
    throw new Error(message || "Credit spend failed");
  }

  return data as SpendResult;
}
