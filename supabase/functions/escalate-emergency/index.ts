import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = user.id;

    const { session_id, appointment_id, peer_session_id, justification, transcript_snippet } = await req.json();

    // Must provide exactly one session reference
    const refs = [session_id, appointment_id, peer_session_id].filter(Boolean);
    if (refs.length !== 1) {
      return new Response(JSON.stringify({ error: "Provide exactly one of session_id, appointment_id, or peer_session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let studentId: string;
    let sessionRef: { table: string; id: string; flagLevel?: number; escalationReason?: string | null };

    // ---- Resolve session type and verify caller ----

    if (session_id) {
      // BlackBox session
      const { data: session, error: sessErr } = await admin
        .from("blackbox_sessions")
        .select("id, student_id, therapist_id, flag_level, escalation_reason, status")
        .eq("id", session_id)
        .single();
      if (sessErr || !session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify caller is therapist or expert
      const isTherapist = session.therapist_id === callerId;
      let isExpert = false;
      if (!isTherapist) {
        const { data: roleCheck } = await admin.from("user_roles").select("id").eq("user_id", callerId).eq("role", "expert").limit(1);
        isExpert = !!(roleCheck && roleCheck.length > 0);
      }
      if (!isTherapist && !isExpert) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      studentId = session.student_id;
      sessionRef = { table: "blackbox_sessions", id: session.id, flagLevel: session.flag_level, escalationReason: session.escalation_reason };

    } else if (appointment_id) {
      // Expert appointment
      const { data: appt, error: apptErr } = await admin
        .from("appointments")
        .select("id, student_id, expert_id, status")
        .eq("id", appointment_id)
        .single();
      if (apptErr || !appt) {
        return new Response(JSON.stringify({ error: "Appointment not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (appt.expert_id !== callerId) {
        // Check if caller has expert role as fallback
        const { data: roleCheck } = await admin.from("user_roles").select("id").eq("user_id", callerId).eq("role", "expert").limit(1);
        if (!roleCheck || roleCheck.length === 0) {
          return new Response(JSON.stringify({ error: "Not authorized" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      studentId = appt.student_id;
      sessionRef = { table: "appointments", id: appt.id };

    } else {
      // Peer session (intern escalation)
      const { data: peerSess, error: peerErr } = await admin
        .from("peer_sessions")
        .select("id, student_id, intern_id, status, is_flagged")
        .eq("id", peer_session_id)
        .single();
      if (peerErr || !peerSess) {
        return new Response(JSON.stringify({ error: "Peer session not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (peerSess.intern_id !== callerId) {
        // Check if caller has intern role
        const { data: roleCheck } = await admin.from("user_roles").select("id").eq("user_id", callerId).eq("role", "intern").limit(1);
        if (!roleCheck || roleCheck.length === 0) {
          return new Response(JSON.stringify({ error: "Not authorized" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      studentId = peerSess.student_id;
      sessionRef = { table: "peer_sessions", id: peerSess.id };
    }

    // ---- Common logic: fetch student profile + emergency contact ----

    const { data: studentProfile } = await admin
      .from("profiles")
      .select("institution_id, student_id, username")
      .eq("id", studentId)
      .single();

    const { data: privateData } = await admin
      .from("user_private")
      .select("emergency_name_encrypted, emergency_phone_encrypted, emergency_relation, contact_is_self")
      .eq("user_id", studentId)
      .single();

    const contact = privateData
      ? {
          name: privateData.emergency_name_encrypted || "Not provided",
          phone: privateData.emergency_phone_encrypted || "Not provided",
          relation: privateData.emergency_relation || "Not specified",
          is_self: privateData.contact_is_self || false,
        }
      : null;

    // Find SPOC for institution — check user_roles table (authoritative source)
    let spocId = callerId;
    if (studentProfile?.institution_id) {
      // Join user_roles with profiles to find SPOCs in the same institution
      const { data: spocProfiles } = await admin
        .from("user_roles")
        .select("user_id, profiles:user_id(id, institution_id)")
        .eq("role", "spoc");

      const institutionSpoc = (spocProfiles || []).find(
        (sp: any) => sp.profiles?.institution_id === studentProfile.institution_id
      );

      if (institutionSpoc) {
        spocId = institutionSpoc.user_id;
      } else {
        // Fallback: notify an admin instead
        const { data: adminRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        if (adminRoles && adminRoles.length > 0) {
          spocId = adminRoles[0].user_id;
        }
      }
    }

    // Look up escalator's role
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const escalatedByRole = callerRoles && callerRoles.length > 0
      ? callerRoles.map((r: any) => r.role).join(", ")
      : "unknown";

    // Build trigger_snippet
    const triggerSnippet = JSON.stringify({
      type: "emergency_contact",
      ...(contact || {}),
      student_eternia_id: studentProfile?.student_id || null,
      student_username: studentProfile?.username || null,
      transcript_snippet: transcript_snippet || null,
      escalated_by_role: escalatedByRole,
      session_id: sessionRef.id,
      session_type: sessionRef.table,
    });

    // Determine escalation level
    const escalationLevel = session_id ? 3 : 1;
    const escalationStatus = session_id ? "critical" : "pending";

    // Insert escalation request
    const { data: escalation, error: escError } = await admin
      .from("escalation_requests")
      .insert({
        spoc_id: spocId,
        justification_encrypted: justification || `Emergency escalation. ${sessionRef.escalationReason || "Risk detected."}`,
        escalation_level: escalationLevel,
        status: escalationStatus,
        trigger_snippet: triggerSnippet,
        trigger_timestamp: new Date().toISOString(),
        session_id: sessionRef.table === "peer_sessions" ? sessionRef.id : null,
      })
      .select("id")
      .single();

    if (escError) {
      console.error("Escalation insert error:", escError);
      return new Response(JSON.stringify({ error: "Failed to create escalation", details: escError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify SPOC
    const flagLabel = sessionRef.flagLevel ? `L${sessionRef.flagLevel}` : "L1";
    await admin.from("notifications").insert({
      user_id: spocId,
      type: "emergency_escalation",
      title: escalationLevel >= 3 ? "🚨 L3 Emergency — Contact Info Available" : "⚠️ Escalation — Student Concern",
      message: escalationLevel >= 3
        ? `Critical session (${flagLabel}) escalated. Emergency contact: ${contact?.name || "N/A"} (${contact?.phone || "N/A"}, ${contact?.relation || "N/A"}). ${sessionRef.escalationReason || "Immediate attention required."}`
        : `A ${sessionRef.table === "peer_sessions" ? "peer session" : "appointment"} has been escalated. Reason: ${justification || "Concern flagged."}. Emergency contact: ${contact?.name || "N/A"} (${contact?.phone || "N/A"}).`,
      metadata: {
        session_id: sessionRef.id,
        session_type: sessionRef.table,
        student_id: studentId,
        escalated_by: callerId,
        emergency_contact: contact || null,
        student_eternia_id: studentProfile?.student_id || null,
        student_username: studentProfile?.username || null,
      },
    });

    // Notify other experts (for L3 only)
    if (escalationLevel >= 3) {
      const { data: expertProfiles } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "expert")
        .eq("is_active", true)
        .neq("id", callerId);

      if (expertProfiles && expertProfiles.length > 0) {
        await admin.from("notifications").insert(
          expertProfiles.map((e) => ({
            user_id: e.id,
            type: "emergency_escalation",
            title: "🚨 Emergency Case Escalated",
            message: `A critical session (${flagLabel}) has been escalated. ${sessionRef.escalationReason || "Immediate attention required."}`,
            metadata: {
              session_id: sessionRef.id,
              student_id: studentId,
              escalated_by: callerId,
            },
          }))
        );
      }
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action_type: escalationLevel >= 3 ? "l3_emergency_escalation" : "escalation_submitted",
      target_table: sessionRef.table,
      target_id: sessionRef.id,
      metadata: { student_id: studentId, has_contact: !!contact, escalation_level: escalationLevel },
    });

    return new Response(
      JSON.stringify({
        success: true,
        escalation_id: escalation?.id,
        contact,
        student_username: studentProfile?.username,
        student_eternia_id: studentProfile?.student_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("escalate-emergency error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
