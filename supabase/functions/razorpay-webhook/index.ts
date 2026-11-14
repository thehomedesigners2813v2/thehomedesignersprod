import { createClient } from "npm:@supabase/supabase-js@2";
import { emailCompletedProjectPayment } from "../_shared/projectPaymentEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Webhook is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const expected = await hmacHex(webhookSecret, rawBody);
    if (signature !== expected) {
      return new Response(JSON.stringify({ error: "Invalid signature." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    if (event.event !== "payment.captured") {
      return new Response(JSON.stringify({ ignored: event.event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) {
      return new Response(JSON.stringify({ error: "Missing payment details." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("id, status, total_amount, purpose")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) {
      return new Response(JSON.stringify({ error: "Unknown order." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status === "paid") {
      return new Response(JSON.stringify({ status: "already_paid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(payment.amount) !== Math.round(Number(order.total_amount) * 100)) {
      console.error("Amount mismatch for order", payment.order_id);
      return new Response(JSON.stringify({ error: "Amount mismatch." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: fulfillError } = await admin.rpc("fulfill_payment_order", {
      p_payment_order_id: order.id,
      p_razorpay_payment_id: payment.id,
      p_provider_response: payment,
    });
    if (fulfillError) throw fulfillError;
    if (order.purpose === "project_payment") {
      try {
        await emailCompletedProjectPayment(admin, order.id);
      } catch (emailError) {
        console.error("Payment receipt email failed:", emailError);
      }
    }

    return new Response(JSON.stringify({ status: "paid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("razorpay-webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
