import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: { action?: string } = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "BAD_REQUEST", details: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Extract auth token from standard Authorization header (sent automatically by SDK)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    console.log("Auth header present:", !!authHeader, "Token segments:", token ? token.split(".").length : 0);

    if (!token || token.split(".").length !== 3) {
      return new Response(
        JSON.stringify({ error: "SESSION_INVALID", details: "Missing or malformed auth token. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user with Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "SESSION_INVALID", details: userError?.message || "Invalid session. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { action } = body;
    console.log("Action:", action, "User:", user.id);

    // Get VideoSDK credentials
    const VIDEOSDK_API_KEY = Deno.env.get("VIDEOSDK_API_KEY");
    const VIDEOSDK_API_SECRET = Deno.env.get("VIDEOSDK_API_SECRET");

    if (!VIDEOSDK_API_KEY || !VIDEOSDK_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "VIDEOSDK_CONFIG_MISSING", details: "Video service credentials are not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate VideoSDK JWT
    const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = toBase64Url(
      JSON.stringify({
        apikey: VIDEOSDK_API_KEY,
        permissions: ["allow_join", "allow_mod"],
        iat: now,
        exp: now + 7200,
      }),
    );

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(VIDEOSDK_API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
    const signature = arrayBufferToBase64Url(signatureBytes);
    const videosdkToken = `${header}.${payload}.${signature}`;

    if (action === "get-token") {
      return new Response(JSON.stringify({ token: videosdkToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-room") {
      const roomResponse = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: { Authorization: videosdkToken, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const responseText = await roomResponse.text();
      console.log("VideoSDK upstream status:", roomResponse.status);

      let roomData: Record<string, any>;
      try {
        roomData = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({
            error: "VIDEOSDK_UPSTREAM_ERROR",
            details: `Video provider returned status ${roomResponse.status} with non-JSON body`,
            upstream_status: roomResponse.status,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!roomResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "VIDEOSDK_UPSTREAM_ERROR",
            details: roomData?.message || roomData?.error || `Video provider returned ${roomResponse.status}`,
            upstream_status: roomResponse.status,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ token: videosdkToken, roomId: roomData.roomId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "BAD_REQUEST", details: 'Invalid action. Use "get-token" or "create-room".' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
