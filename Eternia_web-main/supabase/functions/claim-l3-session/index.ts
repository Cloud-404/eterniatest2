import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is expert
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "expert")
      .limit(1);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Not an expert" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch session — only allow claiming non-completed sessions
    const { data: session, error: sessErr } = await admin
      .from("blackbox_sessions")
      .select("id, escalation_history, flag_level, status, therapist_id")
      .eq("id", session_id)
      .gte("flag_level", 3)
      .in("status", ["active", "accepted", "queued", "escalated"])
      .single();

    if (sessErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found or not L3+" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already claimed by another expert
    const history = Array.isArray(session.escalation_history) ? session.escalation_history : [];
    const existingClaim = (history as any[]).find(
      (entry: any) => entry?.type === "expert_claimed"
    );

    if (existingClaim) {
      if (existingClaim.expert_id === user.id) {
        // Already claimed by this expert — OK
        return new Response(JSON.stringify({ success: true, already_claimed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Claimed by another expert
      return new Response(JSON.stringify({ error: "Session already claimed by another expert", claimed_by: existingClaim.expert_id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic claim: append expert_claimed entry
    const claimEntry = {
      type: "expert_claimed",
      expert_id: user.id,
      timestamp: new Date().toISOString(),
    };
    const joinEntry = {
      type: "expert_joined",
      expert_id: user.id,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...history, joinEntry, claimEntry];

    const { data: updated, error: updateErr } = await admin
      .from("blackbox_sessions")
      .update({
        status: "active",
        escalation_history: updatedHistory,
      })
      .eq("id", session_id)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to claim session", details: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updated) {
      return new Response(JSON.stringify({ error: "Session was modified concurrently" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify therapist
    if (session.therapist_id) {
      await admin.from("notifications").insert({
        user_id: session.therapist_id,
        type: "expert_joined",
        title: "Expert has joined your session",
        message: "An expert has joined the escalated session. You may stay or leave.",
        metadata: { session_id, expert_id: user.id },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("claim-l3-session error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
