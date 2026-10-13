import { corsHeaders, errorResponse, jsonResponse } from "../_shared/security.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INDEXNOW_KEY = "b7e4a3f1-9d2c-4e8b-a6f0-3c5d7e9f1a2b";
const HOST = "eternia.app";
const SITEMAP_URLS = [
  `https://${HOST}/`,
  `https://${HOST}/login`,
  `https://${HOST}/institution-code`,
  `https://${HOST}/forgot-password`,
  `https://${HOST}/privacy`,
  `https://${HOST}/terms`,
  `https://${HOST}/dpdp`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return errorResponse("Forbidden", 403);

    // Submit to IndexNow (Bing endpoint)
    const payload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: SITEMAP_URLS,
    };

    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    // Log to audit
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action_type: "indexnow_submit",
      metadata: { status: resp.status, urls_count: SITEMAP_URLS.length },
    });

    return jsonResponse({
      success: resp.ok || resp.status === 202,
      status: resp.status,
      urls_submitted: SITEMAP_URLS.length,
    });
  } catch (e) {
    console.error("IndexNow submit error:", e);
    return errorResponse("Internal error", 500);
  }
});
