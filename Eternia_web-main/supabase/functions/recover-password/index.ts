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
    const { username, fragment_pairs, new_password } = await req.json();

    const cleanUsername = sanitizeString(username, 100).toLowerCase();
    if (!cleanUsername) return errorResponse("Username is required");

    // Rate limit per username — 5 attempts per 10 min
    const rl = checkRateLimit(`recover:${cleanUsername}`, 5, 600_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter!);

    if (!Array.isArray(fragment_pairs) || fragment_pairs.length !== 3) {
      return errorResponse("Invalid recovery answers");
    }
    const cleanPassword = sanitizeString(new_password, 128);
    if (cleanPassword.length < 8) {
      return errorResponse("Password must be at least 8 characters");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user
    const email = `${cleanUsername}@eternia.local`;
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return errorResponse("Server error", 500);

    const user = users.users.find((u: any) => u.email === email);
    if (!user) return errorResponse("Invalid credentials", 403);

    // Fetch stored recovery credentials
    const { data: creds, error: credErr } = await supabase
      .from("recovery_credentials")
      .select("fragment_pairs_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (credErr) return errorResponse("Server error", 500);
    if (!creds) return errorResponse("No recovery credentials found", 404);

    // Compare fragment pairs (case-insensitive answers)
    let storedPairs: { hint: string; answer: string }[];
    try {
      storedPairs = JSON.parse(creds.fragment_pairs_encrypted);
    } catch {
      return errorResponse("Recovery data corrupted", 500);
    }

    const pairsMatch = storedPairs.every((stored, i) => {
      const submitted = fragment_pairs[i];
      return (
        stored.hint === submitted?.hint &&
        stored.answer.toLowerCase().trim() === sanitizeString(submitted?.answer, 200).toLowerCase()
      );
    });

    if (!pairsMatch) {
      return errorResponse("Recovery credentials do not match", 403);
    }

    // Reset password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: cleanPassword,
    });

    if (updateErr) return errorResponse("Failed to reset password: " + updateErr.message, 500);

    return jsonResponse({ success: true, message: "Password reset successfully" });
  } catch {
    return errorResponse("Invalid request", 400);
  }
});
