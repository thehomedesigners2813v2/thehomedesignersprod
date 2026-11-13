import { createClient } from "npm:@supabase/supabase-js@2";
import { emailCompletedProjectPayment } from "../_shared/projectPaymentEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Please sign in again to continue." }, 401);

    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: designer } = await admin
      .from("designers")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!adminRow && !designer) return json({ error: "You are not allowed to review this payment." }, 403);

    const body = await req.json();
    const paymentOrderId = String(body?.paymentOrderId || "");
    const note = body?.note ? String(body.note).slice(0, 500) : null;
    if (!/^[0-9a-f-]{36}$/i.test(paymentOrderId)) return json({ error: "Invalid payment." }, 400);

    const { data: order } = await admin
      .from("payment_orders")
      .select("id, method, status, purpose, designer_id, reference_id")
      .eq("id", paymentOrderId)
      .maybeSingle();
    if (!order) return json({ error: "Payment not found." }, 404);
    if (order.method !== "upi" || order.status !== "awaiting_review") {
      return json({ error: "Only UPI payments awaiting review can be decided." }, 400);
    }
    const designerCanReview = order.purpose === "quote_advance" || order.purpose === "project_payment";
    if (!adminRow && (!designerCanReview || order.designer_id !== designer?.id)) {
      return json({ error: "You can only confirm a payment for your own project." }, 403);
    }

    const reviewer = { reviewed_by: userData.user.id, reviewed_at: new Date().toISOString(), review_note: note };

    if (body?.action === "approve") {
      const { error } = await admin.rpc("fulfill_payment_order", {
        p_payment_order_id: order.id,
        p_razorpay_payment_id: null,
        p_provider_response: null,
      });
      if (error) throw error;
      const { error: updateError } = await admin.from("payment_orders").update(reviewer).eq("id", order.id);
      if (updateError) throw updateError;
      if (order.purpose === "project_payment") {
        try {
          await emailCompletedProjectPayment(admin, order.id);
        } catch (emailError) {
          console.error("Payment receipt email failed:", emailError);
        }
      }
      return json({ status: "paid" });
    }

    if (body?.action === "reject") {
      const { error } = await admin
        .from("payment_orders")
        .update({ ...reviewer, status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      if (error) throw error;
      if (order.purpose === "project_payment") {
        const { error: requestError } = await admin
          .from("project_payment_requests")
          .update({ status: "requested", payment_order_id: null, updated_at: new Date().toISOString() })
          .eq("id", order.reference_id)
          .eq("status", "awaiting_review");
        if (requestError) throw requestError;
      }
      return json({ status: "rejected" });
    }

    return json({ error: "Unknown review action." }, 400);
  } catch (err) {
    console.error("payment-review error:", err);
    return json({ error: "Something went wrong while saving the review." }, 500);
  }
});
