import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id, reason } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch session and verify therapist ownership
    const { data: session, error: fetchErr } = await adminClient
      .from("blackbox_sessions")
      .select("id, student_id, therapist_id, status, refunded, student_joined_at")
      .eq("id", session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.therapist_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the assigned therapist can refund" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.refunded) {
      return new Response(JSON.stringify({ error: "Already refunded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only refund if student never joined
    if (session.student_joined_at) {
      return new Response(JSON.stringify({ error: "Student already joined — no refund eligible" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the original spend transaction to determine actual amount charged
    const { data: spendTx } = await adminClient
      .from("credit_transactions")
      .select("id, delta")
      .eq("reference_id", session.id)
      .eq("type", "spend")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const refundAmount = spendTx ? Math.abs(spendTx.delta) : 0;

    if (refundAmount > 0) {
      // Refund actual amount to student
      const { error: creditErr } = await adminClient
        .from("credit_transactions")
        .insert({
          user_id: session.student_id,
          delta: refundAmount,
          type: "grant",
          notes: `BlackBox session refund: ${reason || "user unresponsive"}`,
          reference_id: session.id,
        });

      if (creditErr) {
        return new Response(JSON.stringify({ error: "Failed to issue refund" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Mark session as completed + refunded
    await adminClient
      .from("blackbox_sessions")
      .update({
        status: "completed",
        refunded: true,
        ended_at: new Date().toISOString(),
        escalation_reason: reason || "User unresponsive — session refunded",
      })
      .eq("id", session_id);

    // Audit log for session refund
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "session_refund",
      target_table: "blackbox_sessions",
      target_id: session_id,
      metadata: {
        student_id: session.student_id,
        reason: reason || "User unresponsive",
        refund_amount: refundAmount,
      },
    });

    return new Response(JSON.stringify({ success: true, refund_amount: refundAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
