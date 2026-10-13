import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dateRange = "30d" } = await req.json();

    // Calculate range date
    const now = new Date();
    let rangeDate: Date;
    switch (dateRange) {
      case "today":
        rangeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "7d":
        rangeDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        rangeDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        rangeDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch analytics data
    const PAGE_SIZE = 1000;
    let allEvents: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("id, user_id, session_hash, page_path, screen_size, created_at, referrer, user_agent")
        .gte("created_at", rangeDate.toISOString())
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allEvents = allEvents.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Fetch consent stats
    const { data: profileData } = await supabase
      .from("profiles")
      .select("cookie_consent");
    const consentStats = { accepted: 0, rejected: 0, pending: 0 };
    (profileData || []).forEach((p: any) => {
      const status = p.cookie_consent || "pending";
      if (status in consentStats) consentStats[status as keyof typeof consentStats]++;
    });

    // Fetch total registered users
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Compute metrics
    const totalViews = allEvents.length;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const viewsToday = allEvents.filter(e => e.created_at >= todayStart).length;
    const viewsWeek = allEvents.filter(e => e.created_at >= weekAgo).length;

    const authUsers = new Set(allEvents.filter(e => e.user_id).map(e => e.user_id));
    const anonSessions = new Set(allEvents.filter(e => !e.user_id).map(e => e.session_hash));
    const uniqueVisitors = authUsers.size + anonSessions.size;

    // Sessions
    const sessionPages: Record<string, any[]> = {};
    allEvents.forEach(e => {
      if (!sessionPages[e.session_hash]) sessionPages[e.session_hash] = [];
      sessionPages[e.session_hash].push(e);
    });
    const totalSessions = Object.keys(sessionPages).length;
    const bounceSessions = Object.values(sessionPages).filter(p => p.length === 1).length;
    const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 100) : 0;
    const pagesPerSession = totalSessions > 0 ? (totalViews / totalSessions).toFixed(1) : "0";

    // Device breakdown
    const devices = { mobile: 0, tablet: 0, desktop: 0 };
    allEvents.forEach(e => {
      if (!e.screen_size) return;
      const w = parseInt(e.screen_size.split("x")[0]);
      if (w < 768) devices.mobile++;
      else if (w < 1024) devices.tablet++;
      else devices.desktop++;
    });

    // Browser breakdown
    function parseBrowser(ua: string | null): string {
      if (!ua) return "Unknown";
      if (ua.includes("Edg/")) return "Edge";
      if (ua.includes("OPR/")) return "Opera";
      if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
      if (ua.includes("Firefox/")) return "Firefox";
      if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
      return "Other";
    }
    const browserCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const b = parseBrowser(e.user_agent);
      browserCounts[b] = (browserCounts[b] || 0) + 1;
    });

    // Top pages
    const pageCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      pageCounts[e.page_path] = (pageCounts[e.page_path] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([path, count]) => ({ path, count }));

    // Top referrers
    function extractDomain(ref: string | null): string {
      if (!ref || ref === "" || ref === "null") return "(direct)";
      try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return ref; }
    }
    const refCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const d = extractDomain(e.referrer);
      refCounts[d] = (refCounts[d] || 0) + 1;
    });
    const topReferrers = Object.entries(refCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));

    // Daily trend
    const dailyCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const day = e.created_at.split("T")[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    const dailyTrend = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b));

    // Build data summary for AI
    const dataSummary = `
ANALYTICS REPORT DATA — ${dateRange} range (${rangeDate.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]})

OVERVIEW:
- Total Page Views: ${totalViews}
- Views Today: ${viewsToday}
- Views This Week: ${viewsWeek}
- Unique Visitors: ${uniqueVisitors} (${authUsers.size} authenticated, ${anonSessions.size} anonymous)
- Total Sessions: ${totalSessions}
- Bounce Rate: ${bounceRate}%
- Pages Per Session: ${pagesPerSession}
- Total Registered Users: ${totalUsers || "N/A"}

DEVICE BREAKDOWN:
- Desktop: ${devices.desktop} (${totalViews > 0 ? Math.round((devices.desktop / totalViews) * 100) : 0}%)
- Mobile: ${devices.mobile} (${totalViews > 0 ? Math.round((devices.mobile / totalViews) * 100) : 0}%)
- Tablet: ${devices.tablet} (${totalViews > 0 ? Math.round((devices.tablet / totalViews) * 100) : 0}%)

BROWSER BREAKDOWN:
${Object.entries(browserCounts).sort(([, a], [, b]) => b - a).map(([b, c]) => `- ${b}: ${c} (${Math.round((c / totalViews) * 100)}%)`).join("\n")}

TOP PAGES (by views):
${topPages.map((p, i) => `${i + 1}. ${p.path} — ${p.count} views`).join("\n")}

TOP TRAFFIC SOURCES:
${topReferrers.map((r, i) => `${i + 1}. ${r.source} — ${r.count} visits`).join("\n")}

DAILY TREND (last ${dailyTrend.length} days):
${dailyTrend.map(([d, c]) => `${d}: ${c} views`).join("\n")}

COOKIE CONSENT:
- Accepted: ${consentStats.accepted}
- Rejected: ${consentStats.rejected}
- Pending: ${consentStats.pending}
`;

    let aiInsights = "";

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a senior web analytics consultant generating an executive analytics report. 
Write a professional, detailed report in Markdown format with these sections:
1. **Executive Summary** — 3-4 sentence overview of key findings
2. **Traffic Analysis** — detailed breakdown of traffic patterns, daily trends, peak times
3. **Audience Insights** — visitor segmentation, device usage, browser preferences
4. **Content Performance** — top performing pages, engagement patterns
5. **Acquisition Analysis** — traffic sources breakdown, referral analysis  
6. **Key Metrics Deep Dive** — bounce rate analysis, session depth, duration insights
7. **Recommendations** — 5-7 actionable recommendations based on the data
8. **Risk Indicators** — any concerning trends or areas needing attention

Use specific numbers from the data. Be analytical and insightful. Include percentages and comparisons where relevant.
Format the report professionally with clear headers and bullet points.`,
              },
              {
                role: "user",
                content: `Generate a comprehensive analytics report from this data:\n\n${dataSummary}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content || "";
        } else if (aiResponse.status === 429) {
          aiInsights = "*AI insights unavailable due to rate limiting. Raw data report provided below.*";
        } else if (aiResponse.status === 402) {
          aiInsights = "*AI insights unavailable — credits exhausted. Raw data report provided below.*";
        }
      } catch (e) {
        console.error("AI error:", e);
        aiInsights = "*AI insights generation failed. Raw data report provided below.*";
      }
    } else {
      aiInsights = "*AI insights not available (API key not configured). Raw data report provided below.*";
    }

    // Return structured JSON for client-side PDF generation
    return new Response(JSON.stringify({
      aiInsights,
      dateRange,
      period: { from: rangeDate.toISOString().split("T")[0], to: now.toISOString().split("T")[0] },
      generatedAt: now.toISOString(),
      metrics: {
        totalViews,
        viewsToday,
        viewsWeek,
        uniqueVisitors,
        authUsers: authUsers.size,
        anonSessions: anonSessions.size,
        totalSessions,
        bounceRate,
        pagesPerSession,
        totalUsers: totalUsers || 0,
      },
      devices,
      browserCounts,
      topPages,
      topReferrers,
      dailyTrend,
      consentStats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Report generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Failed to generate report" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
