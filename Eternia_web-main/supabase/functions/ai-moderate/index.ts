import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiter
const rateStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const e = rateStore.get(key);
  if (!e || now > e.resetAt) { rateStore.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  e.count++;
  return e.count <= max;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`ai-mod:${ip}`, 30)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller
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

    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content.trim().slice(0, 5000) : "";
    const entry_id = typeof body?.entry_id === "string" && /^[0-9a-f-]{36}$/i.test(body.entry_id) ? body.entry_id : null;

    if (!content || !entry_id) {
      return new Response(JSON.stringify({ error: "content and entry_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller owns the entry
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: entry } = await adminClient
      .from("blackbox_entries")
      .select("user_id")
      .eq("id", entry_id)
      .single();

    if (!entry || entry.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Entry not found or unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a mental health content safety classifier for a student wellness platform. Classify the emotional risk level of user-submitted text. Respond with ONLY a single digit 0-3:

0 = Normal/healthy expression (journaling, gratitude, mild stress)
1 = L1 Mild distress (frustration, sadness, anxiety, loneliness)  
2 = L2 Moderate concern (persistent hopelessness, isolation, self-harm ideation without plan)
3 = L3 Critical/crisis (explicit self-harm intent, suicidal ideation with plan, danger to self or others)

Respond with ONLY the number. No explanation.`,
          },
          {
            role: "user",
            content: content.substring(0, 2000),
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Gateway error:", aiResponse.status, await aiResponse.text());
      return new Response(JSON.stringify({ flag_level: 0, entry_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawLevel = aiData.choices?.[0]?.message?.content?.trim() || "0";
    const flag_level = Math.min(3, Math.max(0, parseInt(rawLevel, 10) || 0));

    await adminClient
      .from("blackbox_entries")
      .update({ ai_flag_level: flag_level })
      .eq("id", entry_id);

    return new Response(JSON.stringify({ flag_level, entry_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI moderation error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, flag_level: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
