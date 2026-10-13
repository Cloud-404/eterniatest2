import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Validate calling user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("username, student_id, institution_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw new Error("Profile not found");

    // Fetch institution name if linked
    let institutionName = "Independent";
    if (profile.institution_id) {
      const { data: inst } = await adminClient
        .from("institutions")
        .select("name")
        .eq("id", profile.institution_id)
        .single();
      if (inst) institutionName = inst.name;
    }

    const requestedAt = new Date().toISOString();

    // Always log to audit_logs first (even if notifications fail later)
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "account_deletion_requested",
      target_table: "profiles",
      target_id: user.id,
      metadata: {
        username: profile.username,
        student_id: profile.student_id,
        institution_id: profile.institution_id,
        institution_name: institutionName,
        requested_at: requestedAt,
      },
    });

    // Set deletion_requested_at on profile
    await adminClient
      .from("profiles")
      .update({ deletion_requested_at: requestedAt })
      .eq("id", user.id);

    // Find admin user_ids via user_roles (service role bypasses RLS)
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    // Fallback: if no admins found, try SPOCs from same institution
    let recipientIds: string[] = (adminRoles || []).map((ar) => ar.user_id);

    if (recipientIds.length === 0 && profile.institution_id) {
      const { data: spocProfiles } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "spoc");

      if (spocProfiles && spocProfiles.length > 0) {
        // Filter SPOCs to same institution
        const { data: institutionSpocs } = await adminClient
          .from("profiles")
          .select("id")
          .in("id", spocProfiles.map((s) => s.user_id))
          .eq("institution_id", profile.institution_id);
        
        recipientIds = (institutionSpocs || []).map((p) => p.id);
      }
    }

    // If still no recipients, try all SPOCs globally
    if (recipientIds.length === 0) {
      const { data: allSpocs } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "spoc");
      recipientIds = (allSpocs || []).map((s) => s.user_id);
    }

    if (recipientIds.length === 0) {
      // Request is logged and profile flagged, but no one to notify
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Your deletion request has been recorded. No administrators are currently available to review it — please contact your institution directly.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert notifications to all recipients
    const notifications = recipientIds.map((rid) => ({
      user_id: rid,
      type: "deletion_request",
      title: "Account Deletion Request",
      message: `User "${profile.username}" (${profile.student_id || "No Eternia ID"}) from ${institutionName} has requested account deletion under DPDP Act 2023.`,
      metadata: {
        requesting_user_id: user.id,
        requesting_username: profile.username,
        student_id: profile.student_id,
        institution_id: profile.institution_id,
        institution_name: institutionName,
        requested_at: requestedAt,
      },
    }));

    const { error: notifError } = await adminClient.from("notifications").insert(notifications);
    if (notifError) {
      console.error("Notification insert error:", notifError);
      // Don't throw — request is already logged and profile flagged
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Request account deletion error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
