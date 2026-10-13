import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Not authenticated");

    // Verify user is SPOC
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, institution_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "spoc") throw new Error("Unauthorized: SPOC role required");
    if (!profile.institution_id) throw new Error("No institution linked");

    // Pick an unused temp credential for this institution
    const { data: cred, error: credError } = await supabase
      .from("temp_credentials")
      .select("id, temp_username, temp_password_plain, institution_id")
      .eq("institution_id", profile.institution_id)
      .eq("status", "unused")
      .limit(1)
      .single();

    if (credError || !cred) {
      throw new Error("No temp IDs available. Ask admin to generate more.");
    }

    // Mark as assigned
    const { error: updateError } = await supabase
      .from("temp_credentials")
      .update({ status: "assigned", assigned_at: new Date().toISOString() })
      .eq("id", cred.id);

    if (updateError) throw new Error("Failed to assign temp credential");

    const qrPayload = JSON.stringify({
      temp_id: cred.temp_username,
      temp_password: cred.temp_password_plain,
      institution_id: cred.institution_id,
    });

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "spoc_qr_generated",
      target_table: "temp_credentials",
      target_id: cred.id,
      metadata: { temp_username: cred.temp_username, generated_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ qr_payload: qrPayload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
