import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  checkRateLimit,
  rateLimitResponse,
  getClientIP,
  sanitizeString,
  errorResponse,
  jsonResponse,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = getClientIP(req);
    const rl = checkRateLimit(`hints:${ip}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter!);

    const { username } = await req.json();
    const cleanUsername = sanitizeString(username, 100).toLowerCase();
    if (!cleanUsername) return errorResponse("Username is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user by email
    const email = `${cleanUsername}@eternia.local`;
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return errorResponse("Server error", 500);

    const user = users.users.find((u: any) => u.email === email);
    if (!user) return errorResponse("No account found with that username", 404);

    // Fetch recovery credentials
    const { data: creds, error: credErr } = await supabase
      .from("recovery_credentials")
      .select("fragment_pairs_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (credErr) return errorResponse("Server error", 500);
    if (!creds) return errorResponse("No recovery credentials set up for this account. Contact your SPOC for help.", 404);

    // Parse fragment pairs and return only hints (not answers)
    let hints: string[] = [];
    try {
      const pairs = JSON.parse(creds.fragment_pairs_encrypted);
      hints = pairs.map((p: { hint: string }) => p.hint);
    } catch {
      return errorResponse("Recovery data corrupted. Contact your SPOC.", 500);
    }

    return jsonResponse({ hints });
  } catch {
    return errorResponse("Invalid request", 400);
  }
});
