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

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
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

    if (!isAdmin && !isSpoc) throw new Error("Only admins and SPOCs can add members");

    const { username, password, role, institution_id } = await req.json();

    if (!username || !password || !role) {
      throw new Error("username, password, and role are required");
    }

    // SPOCs can only create students
    if (isSpoc && !isAdmin && role !== "student") {
      throw new Error("SPOCs can only create student accounts");
    }

    const validRoles = ["student", "intern", "expert", "spoc", "therapist"];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Determine institution_id
    let effectiveInstitutionId: string | null = null;

    if (isSpoc && !isAdmin) {
      // SPOC: force their own institution
      const { data: spocProfile } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", caller.id)
        .single();
      if (!spocProfile?.institution_id) throw new Error("SPOC has no institution assigned");
      effectiveInstitutionId = spocProfile.institution_id;
    } else {
      // Admin: SPOC requires institution_id, student can optionally have one
      if (role === "spoc" && !institution_id) {
        throw new Error("SPOC role requires an institution");
      }
      effectiveInstitutionId = (role === "spoc" || role === "student") && institution_id ? institution_id : null;
    }

    const email = `${username.toLowerCase().replace(/\s+/g, "_")}@eternia.local`;

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createErr) {
      if (createErr.message.includes("already been registered")) {
        throw new Error("A user with this username already exists");
      }
      throw createErr;
    }

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        role,
        ...(effectiveInstitutionId ? { institution_id: effectiveInstitutionId } : {}),
      })
      .eq("id", newUser.user.id);

    if (profileErr) console.error("Profile update error:", profileErr);

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
    });
    if (roleErr && !roleErr.message.includes("duplicate")) {
      console.error("Role insert error:", roleErr);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id,
      action_type: "member_created",
      target_table: "profiles",
      target_id: newUser.user.id,
      metadata: { username, role, institution_id: effectiveInstitutionId },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id, username }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
