import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { temp_username, temp_password } = await req.json();
    if (!temp_username || !temp_password) throw new Error("Missing credentials");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _key: `verify_temp:${temp_username}`,
      _max_requests: 5,
      _window_seconds: 60,
    });
    if (!allowed) throw new Error("Too many attempts. Please wait and try again.");

    // Look up temp credential
    const { data: cred, error } = await supabase
      .from("temp_credentials")
      .select("id, institution_id, temp_password_hash, status, expires_at")
      .eq("temp_username", temp_username.trim())
      .single();

    if (error || !cred) throw new Error("Invalid credentials");
    if (cred.status === "activated") throw new Error("This ID has already been used");
    if (cred.status !== "assigned" && cred.status !== "unused") throw new Error("Invalid credential status");

    // Check expiry
    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      throw new Error("This QR code has expired");
    }

    // Verify password hash
    const inputHash = await hashPassword(temp_password.trim());
    if (inputHash !== cred.temp_password_hash) throw new Error("Invalid credentials");

    // Get institution name
    const { data: institution } = await supabase
      .from("institutions")
      .select("id, name, is_active")
      .eq("id", cred.institution_id)
      .single();

    if (!institution || !institution.is_active) throw new Error("Institution not found or inactive");

    return new Response(
      JSON.stringify({
        valid: true,
        institution_id: cred.institution_id,
        institution_name: institution.name,
        temp_credential_id: cred.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
