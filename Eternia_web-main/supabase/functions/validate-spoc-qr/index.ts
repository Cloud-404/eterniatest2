import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacVerify(key: string, message: string, expectedSig: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === expectedSig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { qr_payload } = await req.json();
    if (!qr_payload) throw new Error("Missing QR payload");

    let payload: any;
    try {
      payload = JSON.parse(qr_payload);
    } catch {
      throw new Error("Invalid QR code format");
    }

    const { institution_id, spoc_id, timestamp, signature } = payload;
    if (!institution_id || !spoc_id || !timestamp || !signature) {
      throw new Error("Invalid QR code data");
    }

    // Verify HMAC signature
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const message = `${institution_id}|${spoc_id}|${timestamp}`;
    const valid = await hmacVerify(secret, message, signature);

    if (!valid) throw new Error("Invalid QR code signature");

    // Verify institution exists and is active
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: institution } = await supabase
      .from("institutions")
      .select("id, name, is_active")
      .eq("id", institution_id)
      .single();

    if (!institution || !institution.is_active) {
      throw new Error("Institution not found or inactive");
    }

    return new Response(JSON.stringify({
      valid: true,
      institution_id,
      institution_name: institution.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
