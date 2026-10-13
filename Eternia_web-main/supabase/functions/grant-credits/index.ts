import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiter
const rateStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const e = rateStore.get(key);
  if (!e || now > e.resetAt) { rateStore.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  e.count++;
  return e.count <= max;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`grant:${ip}`, 15)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate caller
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Not authenticated");

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Not authenticated");
    const callerId = user.id;

    // Verify caller is admin or spoc
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    const { data: isSpoc } = await supabase.rpc("has_role", { _user_id: callerId, _role: "spoc" });
    if (!isAdmin && !isSpoc) throw new Error("Unauthorized: admin or SPOC role required");

    const body = await req.json();
    const username = typeof body?.username === "string" ? body.username.trim().slice(0, 100) : "";
    const amount = parseInt(body?.amount);
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : "";
    const bulk = body?.bulk === true;
    const institution_id = typeof body?.institution_id === "string" && /^[0-9a-f-]{36}$/i.test(body.institution_id) ? body.institution_id : null;

    if (isNaN(amount) || amount <= 0 || amount > 10000) throw new Error("Invalid amount (1-10000)");

    // --- Bulk grant mode ---
    if (bulk && institution_id) {
      const { data: students, error: studentsErr } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("institution_id", institution_id)
        .eq("role", "student")
        .eq("is_active", true);
      if (studentsErr) throw studentsErr;
      if (!students || students.length === 0) throw new Error("No active students found");

      const inserts = students.map((s: any) => ({
        user_id: s.id,
        delta: amount,
        type: "grant" as const,
        institution_id,
        notes: notes || "Institutional grant by SPOC",
      }));

      const { error: insertErr } = await supabase.from("credit_transactions").insert(inserts);
      if (insertErr) throw insertErr;

      await supabase.from("audit_logs").insert({
        actor_id: callerId,
        action_type: "credit_grant_bulk",
        target_table: "credit_transactions",
        metadata: { amount, student_count: students.length },
      });

      return new Response(JSON.stringify({ success: true, count: students.length, amount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Single user grant ---
    if (!username) throw new Error("Username is required");

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", username)
      .maybeSingle();
    if (profileErr || !profile) throw new Error("User not found");

    const { data: isStudent } = await supabase.rpc("has_role", { _user_id: profile.id, _role: "student" });
    if (!isStudent) throw new Error("Credits can only be granted to students");

    const { error: creditErr } = await supabase.from("credit_transactions").insert({
      user_id: profile.id,
      delta: amount,
      type: "grant" as const,
      notes: notes || `Admin grant: ${amount} ECC`,
    });
    if (creditErr) throw creditErr;

    await supabase.from("audit_logs").insert({
      actor_id: callerId,
      action_type: "credit_grant_individual",
      target_table: "credit_transactions",
      target_id: profile.id,
      metadata: { username: profile.username, amount, notes },
    });

    return new Response(JSON.stringify({ success: true, username: profile.username, amount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
