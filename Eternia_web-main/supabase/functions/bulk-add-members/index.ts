import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: caller },
    } = await supabaseUser.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    const { data: isSpoc } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "spoc",
    });

    if (!isAdmin && !isSpoc) throw new Error("Only admins and SPOCs can bulk-create members");

    const { institution_id, count, prefix, role = "student" } = await req.json();

    // SPOCs can only create students
    if (isSpoc && !isAdmin && role !== "student") {
      throw new Error("SPOCs can only create student accounts");
    }

    // Determine effective institution_id
    let effectiveInstitutionId = institution_id;

    if (isSpoc && !isAdmin) {
      // Force SPOC's own institution
      const { data: spocProfile } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", caller.id)
        .single();
      if (!spocProfile?.institution_id) throw new Error("SPOC has no institution assigned");
      effectiveInstitutionId = spocProfile.institution_id;
    }

    if (!effectiveInstitutionId || !count) {
      throw new Error("institution_id and count are required");
    }

    const numCount = parseInt(count);
    if (isNaN(numCount) || numCount < 1 || numCount > 500) {
      throw new Error("Count must be between 1 and 500");
    }

    const validRoles = ["student", "intern", "expert", "spoc", "therapist"];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Get institution for code prefix
    const { data: institution, error: instErr } = await supabaseAdmin
      .from("institutions")
      .select("name, eternia_code_hash")
      .eq("id", effectiveInstitutionId)
      .single();

    if (instErr || !institution) throw new Error("Institution not found");

    const instCode = institution.eternia_code_hash;
    const namePrefix =
      prefix ||
      institution.name
        .replace(/[^a-zA-Z]/g, "")
        .toLowerCase()
        .slice(0, 4);

    const created: { user_id: string; username: string; password: string }[] = [];
    const errors: string[] = [];

    // Get existing count for this institution to determine start index
    const { count: existingCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", effectiveInstitutionId);

    const startIndex = (existingCount || 0) + 1;

    for (let i = 0; i < numCount; i++) {
      const idx = String(startIndex + i).padStart(4, "0");
      const username = `${namePrefix}_${idx}`;
      // Generate a random 8-char password
      const password = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map((b) => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 8);
      const email = `${username}@eternia.local`;

      try {
        const { data: newUser, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username, institution_code: instCode },
          });

        if (createErr) {
          errors.push(`${username}: ${createErr.message}`);
          continue;
        }

        // Update profile
        await supabaseAdmin
          .from("profiles")
          .update({ role, institution_id: effectiveInstitutionId })
          .eq("id", newUser.user.id);

        // Add role
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });

        created.push({
          user_id: newUser.user.id,
          username,
          password,
        });
      } catch (e: any) {
        errors.push(`${username}: ${e.message}`);
      }
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id,
      action_type: "bulk_members_created",
      target_table: "profiles",
      metadata: {
        institution_id: effectiveInstitutionId,
        count: created.length,
        role,
        prefix: namePrefix,
        errors: errors.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        created_count: created.length,
        error_count: errors.length,
        members: created,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
