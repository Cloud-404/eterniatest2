import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  checkRateLimit,
  rateLimitResponse,
  getClientIP,
  sanitizeString,
  isValidUUID,
  errorResponse,
  jsonResponse,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = getClientIP(req);
    const rl = checkRateLimit(`approve-reset:${ip}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter!);

    // Verify admin via auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return errorResponse("Unauthorized", 401);
    }
    const adminUserId = claimsData.claims.sub;

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: adminUserId,
      _role: "admin",
    });
    if (!isAdmin) return errorResponse("Admin access required", 403);

    const body = await req.json();
    const { action } = body;

    // Generate random temp password helper
    const generateTempPassword = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
      let pwd = "";
      for (let i = 0; i < 12; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
      }
      return pwd;
    };

    // ─── DIRECT RESET (Admin-initiated for staff roles) ───
    if (action === "direct_reset") {
      const username = sanitizeString(body.username, 100)?.trim()?.toLowerCase();
      if (!username) return errorResponse("Username is required");

      const email = `${username}@eternia.local`;

      // Find user in auth
      const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) return errorResponse("Server error", 500);

      const user = users.users.find((u: any) => u.email === email);
      if (!user) return errorResponse("User not found", 404);

      // Check user has staff role (expert, intern, or therapist)
      const { data: staffRoles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["expert", "intern", "therapist"]);

      if (rolesErr) return errorResponse("Server error", 500);
      if (!staffRoles || staffRoles.length === 0) {
        return errorResponse("Can only reset passwords for Expert, Intern, or Therapist accounts");
      }

      const tempPassword = generateTempPassword();

      const { error: updateUserErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: tempPassword }
      );
      if (updateUserErr) {
        return errorResponse("Failed to reset password: " + updateUserErr.message, 500);
      }

      // Create audit trail record
      await supabaseAdmin.from("password_reset_requests").insert({
        username,
        status: "approved",
        admin_id: adminUserId,
        admin_note: "Direct reset by admin",
        temp_password: tempPassword,
        user_id: user.id,
        resolved_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        message: "Password reset successfully",
        temp_password: tempPassword,
        role: staffRoles[0].role,
      });
    }

    // ─── APPROVE / REJECT (existing request-based flow) ───
    const { request_id, admin_note } = body;

    if (!isValidUUID(request_id)) return errorResponse("Invalid request ID");
    if (action !== "approve" && action !== "reject") {
      return errorResponse("Action must be 'approve', 'reject', or 'direct_reset'");
    }

    // Fetch the request
    const { data: resetReq, error: fetchErr } = await supabaseAdmin
      .from("password_reset_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();

    if (fetchErr) return errorResponse("Server error", 500);
    if (!resetReq) return errorResponse("Request not found", 404);
    if (resetReq.status !== "pending") {
      return errorResponse("Request already processed");
    }

    if (action === "reject") {
      const { error: updateErr } = await supabaseAdmin
        .from("password_reset_requests")
        .update({
          status: "rejected",
          admin_id: adminUserId,
          admin_note: sanitizeString(admin_note, 500) || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request_id);

      if (updateErr) return errorResponse("Failed to reject", 500);
      return jsonResponse({ success: true, message: "Request rejected" });
    }

    // action === "approve"
    const email = `${resetReq.username.toLowerCase()}@eternia.local`;
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) return errorResponse("Server error", 500);

    const user = users.users.find((u: any) => u.email === email);
    if (!user) return errorResponse("User not found in auth system", 404);

    const tempPassword = generateTempPassword();

    const { error: updateUserErr } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: tempPassword }
    );
    if (updateUserErr) {
      return errorResponse("Failed to reset password: " + updateUserErr.message, 500);
    }

    const { error: updateReqErr } = await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: "approved",
        admin_id: adminUserId,
        admin_note: sanitizeString(admin_note, 500) || null,
        temp_password: tempPassword,
        user_id: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateReqErr) {
      return errorResponse("Password reset but failed to update request record", 500);
    }

    return jsonResponse({
      success: true,
      message: "Password reset successfully",
      temp_password: tempPassword,
    });
  } catch {
    return errorResponse("Invalid request", 400);
  }
});
