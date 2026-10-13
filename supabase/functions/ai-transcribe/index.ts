import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Expanded keyword list (~80+ terms) covering diverse distress signals
const SENSITIVE_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "want to die",
  "self-harm", "self harm", "cutting", "hurt myself",
  "abuse", "abused", "violence", "assault",
  "overdose", "pills", "jump off", "hang myself",
  "nobody cares", "better off dead", "can't go on",
  "panic attack", "anxiety attack", "breakdown",
  "stress", "stressed", "anxious", "anxiety", "overwhelmed",
  "crying", "lonely", "loneliness", "scared", "terrified",
  "numb", "empty", "exhausted", "burned out", "burnout",
  "miserable", "suffering", "tormented", "frustrated",
  "angry", "furious", "rage", "shame", "guilty",
  "grief", "mourning", "heartbroken",
  "depressed", "depression", "hopeless", "worthless",
  "failing", "dropped out", "bullied", "bullying", "ragging",
  "harassment", "humiliated", "rejected", "isolated",
  "no friends", "left out", "excluded",
  "drinking", "drunk", "alcohol", "drugs", "smoking",
  "addiction", "addicted",
  "bleed", "bleeding", "scars", "razor", "bridge",
  "rooftop", "hanging", "drowning", "suffocating", "starving",
  "divorce", "breakup", "broken up", "domestic violence",
  "beaten", "molested", "raped", "trauma", "ptsd",
  "flashbacks", "abusive",
  "no purpose", "meaningless", "pointless", "give up", "giving up",
  "lost hope", "no future", "trapped", "stuck", "can't breathe",
  "don't care anymore", "nothing matters", "why bother",
  "what's the point", "no one understands", "all alone",
  "want it to end", "can't take it", "falling apart",
];

const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

// L3 escalation cooldown: 2 minutes — prevents duplicate escalation records from 15s polling
const L3_COOLDOWN_MS = 120_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript, session_id, timestamp_offset, session_type } = await req.json();
    const sType: "blackbox" | "peer" = session_type === "peer" ? "peer" : "blackbox";
    if (!transcript || !session_id) {
      return new Response(JSON.stringify({ error: "transcript and session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lowerTranscript = transcript.toLowerCase();
    const detectedKeywords = SENSITIVE_KEYWORDS.filter((kw) => lowerTranscript.includes(kw));
    const hasKeywords = detectedKeywords.length > 0;
    const isSubstantial = transcript.length > 50;

    if (!hasKeywords && !isSubstantial) {
      return new Response(JSON.stringify({ flag_level: 0, keywords: [], session_id, suggestion: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const keywordContext = hasKeywords
      ? `Detected distress keywords in transcript: ${detectedKeywords.join(", ")}. Use these as additional context but perform your own independent analysis.`
      : `No specific keywords were matched, but the transcript is substantial. Perform a thorough independent risk analysis looking for any signs of emotional distress, risk indicators, or concerning patterns.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a mental health crisis classifier for a student wellness platform. Given a conversation snippet from a voice call, analyze risk indicators and emotional distress signals. Look beyond just keywords — analyze tone, context, intent, and severity of statements.

When providing a recommendation, tailor it to the specific situation:
- L1 (Mild): Suggest active listening techniques, gentle probing questions, or de-escalation phrases the staff can use right now.
- L2 (Moderate): Recommend involving peer support, suggesting a follow-up session, or gently introducing coping strategies.
- L3 (Critical): Advise immediate intervention — contact emergency services, notify SPOC, stay on the line, use safety planning protocols.

Your recommendation should be a single actionable sentence the therapist/expert/intern can act on immediately. ${keywordContext}`,
          },
          { role: "user", content: transcript.substring(0, 2000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_risk",
              description: "Classify the risk level and provide analysis of the conversation snippet",
              parameters: {
                type: "object",
                properties: {
                  risk_level: {
                    type: "integer",
                    description: "0 = No risk detected (normal conversation), 1 = L1 Mild (general distress, sadness, frustration, mild anxiety), 2 = L2 Moderate (persistent hopelessness, isolation talk, passive self-harm ideation), 3 = L3 Critical (explicit self-harm intent, suicidal plan, immediate danger)",
                  },
                  risk_indicators: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific risk indicators detected in the text beyond just keywords",
                  },
                  emotional_signals: {
                    type: "array",
                    items: { type: "string" },
                    description: "Emotional distress signals detected",
                  },
                  reasoning: {
                    type: "string",
                    description: "1-2 sentence explanation of why this risk level was assigned",
                  },
                  recommendation: {
                    type: "string",
                    description: "One actionable recommendation for the therapist/expert/intern to act on immediately based on the current situation",
                  },
                },
                required: ["risk_level", "risk_indicators", "emotional_signals", "reasoning", "recommendation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_risk" } },
        temperature: 0,
      }),
    });

    let flag_level = hasKeywords ? 1 : 0;
    let risk_indicators: string[] = [];
    let emotional_signals: string[] = [];
    let reasoning = hasKeywords ? "Keywords detected in conversation" : "General analysis performed";
    let recommendation = "";

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          flag_level = Math.min(3, Math.max(0, args.risk_level ?? (hasKeywords ? 1 : 0)));
          risk_indicators = args.risk_indicators || [];
          emotional_signals = args.emotional_signals || [];
          reasoning = args.reasoning || reasoning;
          recommendation = args.recommendation || "";
        } catch {
          // Fallback to default
        }
      }
    } else {
      const errBody = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errBody);
      // If rate-limited or payment required, still return gracefully
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        console.warn("AI Gateway rate/payment issue, falling back to keyword-only classification");
      }
    }

    if (flag_level === 0) {
      return new Response(JSON.stringify({ flag_level: 0, keywords: detectedKeywords, session_id, suggestion: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract trigger snippet
    let trigger_snippet: string;
    if (hasKeywords) {
      const firstKeyword = detectedKeywords[0];
      const keywordIndex = lowerTranscript.indexOf(firstKeyword);
      const snippetStart = Math.max(0, keywordIndex - 200);
      const snippetEnd = Math.min(transcript.length, keywordIndex + firstKeyword.length + 200);
      trigger_snippet = transcript.substring(snippetStart, snippetEnd);
    } else {
      trigger_snippet = transcript.substring(0, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const nowISO = new Date().toISOString();

    const newHistoryEntry = {
      level: flag_level,
      keywords: detectedKeywords,
      snippet: trigger_snippet,
      risk_indicators,
      emotional_signals,
      reasoning,
      timestamp: nowISO,
      auto: true,
    };

    if (sType === "peer") {
      await adminClient.from("peer_sessions").update({
        is_flagged: flag_level >= 2,
        escalation_note_encrypted: `AI detected L${flag_level}: ${detectedKeywords.join(", ")} | ${trigger_snippet.substring(0, 500)}`,
      }).eq("id", session_id);
    } else {
      // --- BLACKBOX SESSION: hardened L3 handling ---
      const { data: existingSession } = await adminClient
        .from("blackbox_sessions")
        .select("escalation_history, flag_level, status, student_id")
        .eq("id", session_id)
        .single();

      if (!existingSession) {
        return new Response(JSON.stringify({ error: "Session not found", flag_level: 0 }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingHistory = Array.isArray(existingSession.escalation_history)
        ? existingSession.escalation_history
        : [];

      // Only escalate UP, never down. Preserve highest flag_level.
      const effectiveLevel = Math.max(flag_level, existingSession.flag_level || 0);

      // --- DEDUPE GUARD for L3 ---
      // Check if an L3 escalation was already recorded within the cooldown window
      const alreadyEscalatedRecently =
        effectiveLevel >= 3 &&
        existingHistory.some((entry: any) =>
          entry.level >= 3 &&
          entry.auto === true &&
          (Date.now() - new Date(entry.timestamp).getTime()) < L3_COOLDOWN_MS
        );

      // Update session: keep status continuity-safe
      // Do NOT set status = "escalated" — that drops the student's call state.
      // Instead, set flag_level to 3 and keep status as-is (active/accepted).
      // The expert panel queries by flag_level >= 3, not by status = "escalated".
      const sessionUpdate: Record<string, any> = {
        flag_level: effectiveLevel,
        escalation_reason: `AI detected: ${detectedKeywords.length > 0 ? detectedKeywords.join(", ") : "contextual risk signals"}`,
        escalation_history: [...existingHistory, newHistoryEntry],
      };

      // Only set status to "escalated" if session is still queued (no active call to disrupt)
      if (effectiveLevel >= 3 && existingSession.status === "queued") {
        sessionUpdate.status = "escalated";
      }

      await adminClient.from("blackbox_sessions").update(sessionUpdate).eq("id", session_id);

      // --- L3: Create escalation record + notification (with dedupe) ---
      if (effectiveLevel >= 3 && !alreadyEscalatedRecently) {
        const studentId = existingSession.student_id;

        // Find SPOC for student's institution
        const { data: studentProfile } = await adminClient
          .from("profiles")
          .select("institution_id")
          .eq("id", studentId)
          .single();

        let spocId = SYSTEM_ACTOR_ID;
        if (studentProfile?.institution_id) {
          const { data: spocProfile } = await adminClient
            .from("profiles")
            .select("id")
            .eq("institution_id", studentProfile.institution_id)
            .eq("role", "spoc")
            .limit(1)
            .maybeSingle();
          if (spocProfile) spocId = spocProfile.id;
        }

        // Fetch student profile for structured metadata
        const { data: studentData } = await adminClient
          .from("profiles")
          .select("username, student_id")
          .eq("id", studentId)
          .single();

        // Build structured JSON trigger_snippet so Admin/SPOC dashboards can render it
        const structuredSnippet = JSON.stringify({
          type: "ai_l3_detection",
          transcript_snippet: trigger_snippet.substring(0, 500),
          student_username: studentData?.username || null,
          student_eternia_id: studentData?.student_id || null,
          session_id,
          session_type: sType,
          keywords: detectedKeywords,
          risk_indicators,
          emotional_signals,
          reasoning,
          escalated_by_role: "ai_system",
        });

        // Create escalation_request record with trigger metadata (PRD §19.1)
        await adminClient.from("escalation_requests").insert({
          spoc_id: spocId,
          session_id: session_id,
          justification_encrypted: `AI L3 critical risk: ${reasoning}. Keywords: ${detectedKeywords.join(", ")}`,
          status: "pending",
          escalation_level: 3,
          trigger_snippet: structuredSnippet,
          trigger_timestamp: nowISO,
        });

        // Notify all experts about the L3 session
        const { data: experts } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "expert");

        if (experts && experts.length > 0) {
          const notifications = experts.map((e: any) => ({
            user_id: e.user_id,
            title: "🚨 L3 Critical BlackBox Alert",
            message: `AI detected critical risk in a live BlackBox session. Immediate intervention required.`,
            type: "l3_alert",
            metadata: { session_id, flag_level: 3 },
          }));
          await adminClient.from("notifications").insert(notifications);
        }

        // Also notify SPOC if not system actor
        if (spocId !== SYSTEM_ACTOR_ID) {
          await adminClient.from("notifications").insert({
            user_id: spocId,
            title: "🚨 L3 Escalation — BlackBox Session",
            message: `AI detected critical risk. An escalation record has been created for review.`,
            type: "l3_escalation",
            metadata: { session_id, flag_level: 3 },
          });
        }

        // Audit log for L3 escalation
        await adminClient.from("audit_logs").insert({
          actor_id: SYSTEM_ACTOR_ID,
          action_type: "ai_l3_escalation",
          target_table: "blackbox_sessions",
          target_id: session_id,
          metadata: {
            flag_level: 3,
            keywords: detectedKeywords,
            risk_indicators,
            emotional_signals,
            reasoning,
            trigger_snippet: trigger_snippet.substring(0, 500),
            session_type: sType,
            auto: true,
          },
        });
      }
      // Audit log for L2 (non-L3) detections — no escalation record needed
      else if (flag_level >= 2 && effectiveLevel < 3) {
        await adminClient.from("audit_logs").insert({
          actor_id: existingSession.student_id || SYSTEM_ACTOR_ID,
          action_type: "ai_risk_suggestion",
          target_table: "blackbox_sessions",
          target_id: session_id,
          metadata: {
            flag_level,
            keywords: detectedKeywords,
            risk_indicators,
            emotional_signals,
            session_type: sType,
            auto: true,
            suggestion_only: true,
          },
        });
      }
    }

    const suggestion = {
      risk_level: flag_level,
      keywords: detectedKeywords,
      risk_indicators,
      emotional_signals,
      reasoning,
      recommendation,
      snippet: trigger_snippet,
    };

    return new Response(
      JSON.stringify({ flag_level, keywords: detectedKeywords, trigger_snippet, session_id, suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI transcribe error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, flag_level: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
