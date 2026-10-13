import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Unauthorized: Admin role required");

    const { institution_id, count, prefix } = await req.json();

    if (!institution_id) throw new Error("institution_id is required");
    if (!count || count < 1 || count > 500) throw new Error("count must be 1-500");

    // Get institution name for prefix
    const { data: institution } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", institution_id)
      .single();
    if (!institution) throw new Error("Institution not found");

    const usernamePrefix = (prefix || institution.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4)).toLowerCase();

    // Get current max sequence for this prefix
    const { data: existing } = await supabase
      .from("temp_credentials")
      .select("temp_username")
      .eq("institution_id", institution_id)
      .ilike("temp_username", `${usernamePrefix}_%`)
      .order("temp_username", { ascending: false })
      .limit(1);

    let startSeq = 1;
    if (existing && existing.length > 0) {
      const lastNum = parseInt(existing[0].temp_username.split("_").pop() || "0");
      if (!isNaN(lastNum)) startSeq = lastNum + 1;
    }

    const credentials: { temp_username: string; temp_password: string; temp_password_hash: string }[] = [];
    for (let i = 0; i < count; i++) {
      const seq = startSeq + i;
      const tempUsername = `${usernamePrefix}_${String(seq).padStart(4, "0")}`;
      const tempPassword = generatePassword(8);
      const tempPasswordHash = await hashPassword(tempPassword);
      credentials.push({ temp_username: tempUsername, temp_password: tempPassword, temp_password_hash: tempPasswordHash });
    }

    // Insert in batches
    const rows = credentials.map((c) => ({
      institution_id,
      temp_username: c.temp_username,
      temp_password_hash: c.temp_password_hash,
      temp_password_plain: c.temp_password,
      status: "unused",
      created_by: user.id,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error: insertError } = await supabase.from("temp_credentials").insert(batch);
      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "bulk_temp_ids_created",
      target_table: "temp_credentials",
      target_id: institution_id,
      metadata: { count, prefix: usernamePrefix },
    });

    return new Response(
      JSON.stringify({
        created_count: count,
        members: credentials.map((c) => ({
          username: c.temp_username,
          password: c.temp_password,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
