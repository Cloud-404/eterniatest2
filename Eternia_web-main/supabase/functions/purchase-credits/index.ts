import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PACKAGES: Record<number, { credits: number; amount: number }> = {
  25: { credits: 25, amount: 4900 },
  60: { credits: 60, amount: 9900 },
  130: { credits: 130, amount: 19900 },
};

// Rate limiter
const rateStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 10, windowMs = 60000): boolean {
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
    if (!rateLimit(`purchase:${ip}`, 10)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";

    // ── Create Order ──
    if (action === "create_order") {
      const credits = parseInt(body?.credits);
      const pkg = PACKAGES[credits];
      if (!pkg) {
        return new Response(JSON.stringify({ error: "Invalid package" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        },
        body: JSON.stringify({
          amount: pkg.amount,
          currency: "INR",
          receipt: `ecc_${userId.slice(0, 8)}_${Date.now()}`,
          notes: { user_id: userId, credits: pkg.credits },
        }),
      });

      if (!orderRes.ok) {
        console.error("Razorpay order error:", orderRes.status);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const order = await orderRes.json();
      return new Response(
        JSON.stringify({ order_id: order.id, amount: pkg.amount, key_id: RAZORPAY_KEY_ID }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Verify Payment ──
    if (action === "verify_payment") {
      const razorpay_payment_id = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id.slice(0, 100) : "";
      const razorpay_order_id = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id.slice(0, 100) : "";
      const razorpay_signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature.slice(0, 200) : "";

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return new Response(JSON.stringify({ error: "Missing payment details" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const data = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
      const signature = await crypto.subtle.sign("HMAC", key, data);
      const generatedSignature = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (generatedSignature !== razorpay_signature) {
        return new Response(JSON.stringify({ error: "Payment verification failed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch order to get credits
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: {
          Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        },
      });

      if (!orderRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to verify order" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const order = await orderRes.json();

      // Verify the order belongs to this user
      if (order.notes?.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Order does not belong to this user" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creditAmount = parseInt(order.notes?.credits || "0");
      if (creditAmount <= 0 || !PACKAGES[creditAmount]) {
        return new Response(JSON.stringify({ error: "Invalid credit amount" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Idempotency: check if this payment was already credited
      const paymentTag = `Razorpay: ${razorpay_payment_id.slice(0, 30)}`;
      const { data: existing } = await serviceClient
        .from("credit_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "purchase")
        .ilike("notes", `%${paymentTag}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already credited — return success without double-crediting
        return new Response(
          JSON.stringify({ success: true, credits: creditAmount, already_credited: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertError } = await serviceClient
        .from("credit_transactions")
        .insert({
          user_id: userId,
          delta: creditAmount,
          type: "purchase",
          notes: `Purchased ${creditAmount} ECC (${paymentTag})`,
          reference_id: null,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to credit account" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, credits: creditAmount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("purchase-credits error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
