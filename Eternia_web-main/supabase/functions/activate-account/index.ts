import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      temp_credential_id,
      new_username,
      new_password,
      emergency_name,
      emergency_phone,
      emergency_relation,
      contact_is_self,
      student_id,
      device_fingerprint,
    } = await req.json();

    if (!temp_credential_id) throw new Error("Missing temp_credential_id");
    if (!new_username || new_username.trim().length < 4) throw new Error("Username must be at least 4 characters");
    if (!new_password || new_password.length < 8) throw new Error("Password must be at least 8 characters");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify temp credential is valid and assigned
    const { data: cred, error: credError } = await supabase
      .from("temp_credentials")
      .select("id, institution_id, status, expires_at")
      .eq("id", temp_credential_id)
      .single();

    if (credError || !cred) throw new Error("Invalid temp credential");
    if (cred.status === "activated") throw new Error("This ID has already been activated");
    if (cred.status !== "assigned" && cred.status !== "unused") throw new Error("Invalid credential status");

    if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
      throw new Error("This credential has expired");
    }

    // Check username uniqueness
    const cleanUsername = new_username.trim().toLowerCase().replace(/\s+/g, "_");
    const email = `${cleanUsername}@eternia.local`;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .limit(1);

    if (existingProfile && existingProfile.length > 0) {
      throw new Error("Username already taken. Please choose a different one.");
    }

    // Get institution info for student ID generation
    const { data: institution } = await supabase
      .from("institutions")
      .select("id, name, institution_type")
      .eq("id", cred.institution_id)
      .single();

    if (!institution) throw new Error("Institution not found");

    // Create auth user (handle_new_user trigger will create profile + user_roles + welcome bonus)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: new_password,
      email_confirm: true,
      user_metadata: { username: cleanUsername },
    });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        throw new Error("Username already taken. Please choose a different one.");
      }
      throw new Error(authError.message);
    }

    const userId = authData.user.id;

    // Update profile with institution_id and proper username
    await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        institution_id: cred.institution_id,
      })
      .eq("id", userId);

    // Verify student ID against institution records (using hashed lookup)
    const isSchool = institution.institution_type === "school";
    const idType = isSchool ? "erp" : "apaar";
    const hasStudentId = !!student_id && student_id.trim().length >= 3;
    let idVerified = false;

    // SHA-256 hash function matching verify-student-id and SPOC upload
    async function hashStudentId(instId: string, type: string, rawId: string): Promise<string> {
      const input = `eternia:${instId}:${type}:${rawId}`;
      const encoded = new TextEncoder().encode(input);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    if (hasStudentId) {
      const hashedId = await hashStudentId(cred.institution_id, idType, student_id.trim());

      const { data: matchedId, error: matchErr } = await supabase
        .from("institution_student_ids")
        .select("id, is_claimed")
        .eq("institution_id", cred.institution_id)
        .eq("id_type", idType)
        .eq("student_id_hash", hashedId)
        .maybeSingle();

      if (matchedId) {
        if (matchedId.is_claimed) {
          throw new Error("This student ID has already been claimed by another user.");
        }
        // Mark as claimed
        await supabase
          .from("institution_student_ids")
          .update({ is_claimed: true, claimed_by: userId })
          .eq("id", matchedId.id);
        idVerified = true;
      }
    }

    // If no student ID provided, check if institution has any uploaded IDs
    if (!hasStudentId) {
      const { count } = await supabase
        .from("institution_student_ids")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", cred.institution_id);
      // No records to check against → default pass
      if (!count || count === 0) {
        idVerified = true;
      }
    }

    // Update profile verification status based on ID check result
    await supabase
      .from("profiles")
      .update({ is_verified: idVerified })
      .eq("id", userId);

    // Insert private data — store ONLY verification status, never raw IDs
    await supabase.from("user_private").insert({
      user_id: userId,
      emergency_name_encrypted: emergency_name || null,
      emergency_phone_encrypted: emergency_phone || null,
      emergency_relation: contact_is_self ? "Self" : (emergency_relation || null),
      contact_is_self: contact_is_self || false,
      student_id_encrypted: null,
      device_id_encrypted: device_fingerprint || null,
      apaar_id_encrypted: null,
      erp_id_encrypted: null,
      apaar_verified: !isSchool && idVerified,
      erp_verified: isSchool && idVerified,
    });

    // Mark temp credential as activated
    await supabase
      .from("temp_credentials")
      .update({
        status: "activated",
        activated_at: new Date().toISOString(),
        auth_user_id: userId,
        temp_password_plain: "***CLEARED***",
      })
      .eq("id", temp_credential_id);

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: "account_activated_via_temp_id",
      target_table: "temp_credentials",
      target_id: temp_credential_id,
      metadata: { institution_id: cred.institution_id, username: cleanUsername },
    });

    // Sign in user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: new_password,
    });

    if (signInError) {
      // Account created but couldn't auto-login; user can login manually
      return new Response(
        JSON.stringify({
          success: true,
          auto_login: false,
          message: "Account created. Please log in with your new credentials.",
          username: cleanUsername,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        auto_login: true,
        session: signInData.session,
        username: cleanUsername,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
