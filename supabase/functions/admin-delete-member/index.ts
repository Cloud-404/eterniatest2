import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is admin
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin access required");

    const { target_user_id } = await req.json();
    if (!target_user_id || typeof target_user_id !== "string") throw new Error("target_user_id required");

    // Prevent self-deletion
    if (target_user_id === user.id) throw new Error("Cannot delete your own account from admin panel");

    // Step 1: Look up the user's role before deletion
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", target_user_id)
      .single();

    const targetRole = targetProfile?.role || "student";

    // Step 2: Audit log (always record the attempt)
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "admin_deleted_member",
      target_table: "profiles",
      target_id: target_user_id,
      metadata: { deleted_by: user.id, deleted_at: new Date().toISOString(), role: targetRole },
    });

    // Step 3: Revoke all active sessions, then delete auth user FIRST
    // This immediately prevents login — fail fast if auth deletion fails
    try {
      await adminClient.auth.admin.signOut(target_user_id, "global");
    } catch (_e) {
      // signOut may fail if user has no active sessions — safe to ignore
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    // Step 4: Delete PII (auth is already gone, so this is cleanup)
    await adminClient.from("user_private").delete().eq("user_id", target_user_id);
    await adminClient.from("recovery_credentials").delete().eq("user_id", target_user_id);
    await adminClient.from("blackbox_entries").delete().eq("user_id", target_user_id);

    // Step 5: Soft-delete profile
    await adminClient.from("profiles").update({
      is_active: false,
      username: `deleted_${target_user_id.slice(0, 8)}`,
      bio: null,
      avatar_url: null,
      specialty: null,
    }).eq("id", target_user_id);

    // Step 6: Remove role assignments
    await adminClient.from("user_roles").delete().eq("user_id", target_user_id);

    // Step 7: Handle temp credentials based on role
    if (targetRole === "student") {
      // Recycle student credentials back to pool with fresh password
      const freshPassword = crypto.randomUUID().slice(0, 12);
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(freshPassword));
      const freshHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await adminClient
        .from("temp_credentials")
        .update({
          status: "unused",
          auth_user_id: null,
          activated_at: null,
          assigned_at: null,
          temp_password_plain: freshPassword,
          temp_password_hash: freshHash,
        })
        .eq("auth_user_id", target_user_id);
    } else {
      // Permanently delete staff credentials (spoc, expert, intern, therapist)
      await adminClient
        .from("temp_credentials")
        .delete()
        .eq("auth_user_id", target_user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin delete member error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
