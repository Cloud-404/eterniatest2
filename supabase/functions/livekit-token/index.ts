import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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

async function signLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  payload: Record<string, any>
): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${header}.${encodedPayload}`)
  );
  const signature = arrayBufferToBase64Url(signatureBytes);

  return `${header}.${encodedPayload}.${signature}`;
}

type SessionKind = "appointment" | "peer" | "blackbox" | "l3";

interface TokenRequestBody {
  kind: SessionKind;
  id: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "METHOD_NOT_ALLOWED", details: "Use POST" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate caller using Supabase Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token || token.split(".").length !== 3) {
      return new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          details: "Missing or malformed authorization token.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          details: userError?.message || "Invalid or expired session. Please sign in again.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate request body
    let body: TokenRequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST", details: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { kind, id } = body;
    if (!kind || !id || !UUID_REGEX.test(id)) {
      return new Response(
        JSON.stringify({
          error: "BAD_REQUEST",
          details: "kind ('appointment' | 'peer' | 'blackbox' | 'l3') and valid UUID id are required.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Service role client for authoritative authorization queries
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let roomName: string;
    let participantIdentity: string;
    let participantName: string;
    let canPublishVideo = false;
    let canPublishAudio = true;

    // 4. Server-Side Session Authorization by Workflow
    if (kind === "appointment") {
      const { data: appt, error: apptErr } = await adminClient
        .from("appointments")
        .select("id, student_id, expert_id, status, session_type")
        .eq("id", id)
        .single();

      if (apptErr || !appt) {
        return new Response(
          JSON.stringify({ error: "NOT_FOUND", details: "Appointment not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (appt.status === "cancelled" || appt.status === "completed") {
        return new Response(
          JSON.stringify({
            error: "SESSION_ENDED",
            details: `Appointment has already ${appt.status}.`,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isStudent = appt.student_id === user.id;
      const isExpert = appt.expert_id === user.id;

      if (!isStudent && !isExpert) {
        return new Response(
          JSON.stringify({
            error: "FORBIDDEN",
            details: "You are not an authorized participant for this appointment.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      roomName = `apt_${appt.id}`;
      participantIdentity = isStudent
        ? `apt_student_${user.id.slice(0, 8)}`
        : `apt_expert_${user.id.slice(0, 8)}`;
      participantName = isStudent ? "Student" : "Expert";

      // Video enabled if appointment session_type is video (default in system is video)
      canPublishVideo = (appt.session_type || "video") === "video";

      // Ensure room_id is recorded in appointment row
      await adminClient
        .from("appointments")
        .update({ room_id: roomName })
        .eq("id", id)
        .is("room_id", null);

    } else if (kind === "peer") {
      const { data: session, error: sessErr } = await adminClient
        .from("peer_sessions")
        .select("id, student_id, intern_id, status")
        .eq("id", id)
        .single();

      if (sessErr || !session) {
        return new Response(
          JSON.stringify({ error: "NOT_FOUND", details: "Peer session not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.status !== "active") {
        return new Response(
          JSON.stringify({
            error: "SESSION_NOT_ACTIVE",
            details: `Cannot join peer call in '${session.status}' state. Must be active.`,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isStudent = session.student_id === user.id;
      const isIntern = session.intern_id === user.id;

      if (!isStudent && !isIntern) {
        return new Response(
          JSON.stringify({
            error: "FORBIDDEN",
            details: "You are not a participant in this peer session.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      roomName = `peer_${session.id}`;
      participantIdentity = isStudent
        ? `peer_student_${user.id.slice(0, 8)}`
        : `peer_intern_${user.id.slice(0, 8)}`;
      participantName = isStudent ? "Peer" : "Peer Supporter";
      canPublishVideo = false; // Peer calls are strictly audio

      // Ensure room_id is set
      await adminClient
        .from("peer_sessions")
        .update({ room_id: roomName })
        .eq("id", id)
        .is("room_id", null);

    } else if (kind === "blackbox") {
      const { data: session, error: sessErr } = await adminClient
        .from("blackbox_sessions")
        .select("id, student_id, therapist_id, status, flag_level, room_id")
        .eq("id", id)
        .single();

      if (sessErr || !session) {
        return new Response(
          JSON.stringify({ error: "NOT_FOUND", details: "BlackBox session not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["completed", "cancelled"].includes(session.status)) {
        return new Response(
          JSON.stringify({
            error: "SESSION_ENDED",
            details: `Session has already ${session.status}.`,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isStudent = session.student_id === user.id;
      const isTherapist = session.therapist_id === user.id;

      if (!isStudent && !isTherapist) {
        return new Response(
          JSON.stringify({
            error: "FORBIDDEN",
            details: "You are not the assigned participant for this BlackBox session.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isTherapist) {
        // Double-check caller's role
        const { data: roleCheck } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "therapist")
          .limit(1);

        if (!roleCheck || roleCheck.length === 0) {
          return new Response(
            JSON.stringify({
              error: "FORBIDDEN",
              details: "Therapist role required.",
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      roomName = `bb_${session.id}`;
      // Pseudonymous identity: Never reveal student's real UUID or username to the provider!
      participantIdentity = isStudent
        ? `bb_student_${user.id.slice(0, 6)}_${Math.random().toString(36).slice(2, 6)}`
        : `bb_therapist_${user.id.slice(0, 6)}`;
      participantName = isStudent ? "Anonymous" : "Therapist";
      canPublishVideo = false; // BlackBox is strictly audio

      // Ensure room_id is set
      await adminClient
        .from("blackbox_sessions")
        .update({ room_id: roomName })
        .eq("id", id)
        .is("room_id", null);

    } else if (kind === "l3") {
      // Expert L3 join: Must claim session atomically BEFORE issuing token
      const { data: claimData, error: claimErr } = await adminClient.rpc(
        "claim_l3_session_atomic",
        {
          _session_id: id,
          _expert_id: user.id,
        }
      );

      if (claimErr) {
        return new Response(
          JSON.stringify({
            error: "CLAIM_ERROR",
            details: claimErr.message || "Failed to claim L3 session.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const claimResult = Array.isArray(claimData) ? claimData[0] : claimData;
      if (!claimResult || !claimResult.success) {
        return new Response(
          JSON.stringify({
            error: "CLAIM_REJECTED",
            details: claimResult?.message || "Session could not be claimed.",
            claimed_by: claimResult?.claimed_by,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      roomName = `bb_${id}`;
      participantIdentity = `bb_expert_${user.id.slice(0, 8)}`;
      participantName = "Crisis Specialist";
      canPublishVideo = false;
    } else {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST", details: "Unsupported session kind." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Generate LiveKit Access Token
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") || "devkey";
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") || "secret";
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") || "wss://eternia-livekit.livekit.cloud";

    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = 3600; // 1-hour short-lived token

    const sources = ["microphone"];
    if (canPublishVideo) {
      sources.push("camera");
    }

    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: participantIdentity,
      name: participantName,
      nbf: now - 5,
      exp: now + ttlSeconds,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: sources,
      },
      metadata: JSON.stringify({
        kind,
        sessionId: id,
        role: participantName,
      }),
    };

    const livekitToken = await signLiveKitJwt(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, payload);

    return new Response(
      JSON.stringify({
        token: livekitToken,
        url: LIVEKIT_URL,
        roomName,
        participantIdentity,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[livekit-token] Internal error:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        details: error?.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
