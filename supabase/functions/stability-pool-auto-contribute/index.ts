import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Monthly: deduct 1 ECC from each active student with sufficient balance
    const { data: students, error } = await supabase
      .from("profiles")
      .select("id, institution_id")
      .eq("role", "student")
      .eq("is_active", true)
      .not("institution_id", "is", null);

    if (error) throw error;

    let contributed = 0;
    const poolUpdates: Record<string, number> = {};

    for (const student of students || []) {
      const { data: balance } = await supabase.rpc("get_credit_balance", { _user_id: student.id });
      if ((balance || 0) >= 1) {
        await supabase.from("credit_transactions").insert({
          user_id: student.id,
          delta: -1,
          type: "spend",
          notes: "Monthly ECC Stability Pool contribution",
          institution_id: student.institution_id,
        });
        poolUpdates[student.institution_id!] = (poolUpdates[student.institution_id!] || 0) + 1;
        contributed++;
      }
    }

    // Update pool balances
    for (const [instId, amount] of Object.entries(poolUpdates)) {
      const { data: currentPool } = await supabase
        .from("ecc_stability_pool")
        .select("balance, total_contributed")
        .eq("institution_id", instId)
        .single();

      if (currentPool) {
        await supabase
          .from("ecc_stability_pool")
          .update({
            balance: (currentPool.balance || 0) + amount,
            total_contributed: (currentPool.total_contributed || 0) + amount,
          })
          .eq("institution_id", instId);
      } else {
        await supabase
          .from("ecc_stability_pool")
          .insert({
            institution_id: instId,
            balance: amount,
            total_contributed: amount,
          });
      }
    }

    return new Response(JSON.stringify({ success: true, contributed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
