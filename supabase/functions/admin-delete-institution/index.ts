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

    const { institution_id } = await req.json();
    if (!institution_id || typeof institution_id !== "string") throw new Error("institution_id required");

    // Verify institution exists
    const { data: institution, error: instError } = await adminClient
      .from("institutions")
      .select("id, name")
      .eq("id", institution_id)
      .single();
    if (instError || !institution) throw new Error("Institution not found");

    // Fetch all linked users (paginate beyond 1000)
    let allProfiles: { id: string; role: string }[] = [];
    let from = 0;
    const pageSize = 500;
    while (true) {
      const { data: batch } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("institution_id", institution_id)
        .range(from, from + pageSize - 1);
      if (!batch || batch.length === 0) break;
      allProfiles = allProfiles.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    // Process each linked user
    let deletedCount = 0;
    let errorCount = 0;
    for (const profile of allProfiles) {
      try {
        // Delete PII
        await adminClient.from("user_private").delete().eq("user_id", profile.id);
        await adminClient.from("recovery_credentials").delete().eq("user_id", profile.id);
        await adminClient.from("blackbox_entries").delete().eq("user_id", profile.id);

        // Soft-delete profile and null out institution_id
        await adminClient.from("profiles").update({
          is_active: false,
          username: `deleted_${profile.id.slice(0, 8)}`,
          bio: null,
          avatar_url: null,
          specialty: null,
          institution_id: null,
        }).eq("id", profile.id);

        // Remove roles
        await adminClient.from("user_roles").delete().eq("user_id", profile.id);

        // Delete auth user
        const { error: delErr } = await adminClient.auth.admin.deleteUser(profile.id);
        if (delErr) {
          console.error(`Failed to delete auth user ${profile.id}:`, delErr);
        }

        // Handle temp credentials based on role
        if (profile.role === "student") {
          // For students: credentials will be deleted with institution anyway
          // but mark unused first in case they belong to another institution
          await adminClient
            .from("temp_credentials")
            .update({ status: "unused", auth_user_id: null, activated_at: null, assigned_at: null })
            .eq("auth_user_id", profile.id);
        } else {
          await adminClient
            .from("temp_credentials")
            .delete()
            .eq("auth_user_id", profile.id);
        }

        deletedCount++;
      } catch (err) {
        console.error(`Error processing user ${profile.id}:`, err);
        errorCount++;
      }
    }

    // Delete institution's stability pool
    await adminClient.from("ecc_stability_pool").delete().eq("institution_id", institution_id);

    // Delete institution's student ID hashes
    await adminClient.from("institution_student_ids").delete().eq("institution_id", institution_id);

    // Delete institution's remaining temp credentials
    await adminClient.from("temp_credentials").delete().eq("institution_id", institution_id);

    // Delete the institution itself
    const { error: deleteInstError } = await adminClient
      .from("institutions")
      .delete()
      .eq("id", institution_id);
    if (deleteInstError) throw new Error(`Failed to delete institution: ${deleteInstError.message}`);

    // Audit log
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "admin_deleted_institution",
      target_table: "institutions",
      target_id: institution_id,
      metadata: {
        institution_name: institution.name,
        users_deleted: deletedCount,
        errors: errorCount,
        deleted_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      users_deleted: deletedCount,
      errors: errorCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin delete institution error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
