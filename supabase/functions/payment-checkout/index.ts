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

const FEE_RATE = 0.02;
const UPI_ID = "8722263004@axisbank";
const UPI_PAYEE = "The Home Designers";
const PURPOSES = ["designer_subscription", "ai_subscription", "wallpaper_order", "quote_advance", "project_payment"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TXN_RE = /^[A-Za-z0-9]{6,30}$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Please sign in again to continue." }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      return await createPayment(admin, userId, body);
    }
    if (action === "submit_upi") {
      return await submitUpi(admin, userId, body);
    }
    if (action === "verify_razorpay") {
      return await verifyRazorpay(admin, userId, body);
    }
    return json({ error: "Unknown payment action." }, 400);
  } catch (err) {
    console.error("payment-checkout error:", err);
    return json({ error: "Something went wrong with the payment. Please try again." }, 500);
  }
});

type Admin = ReturnType<typeof createClient>;

async function resolveOrder(
  admin: Admin,
  userId: string,
  purpose: string,
  referenceId: string,
): Promise<{ baseAmount: number; designerId: string | null }> {
  if (purpose === "designer_subscription" || purpose === "ai_subscription") {
    const { data: designer } = await admin.from("designers").select("id").eq("user_id", userId).maybeSingle();
    if (!designer) throw new PaymentError("A designer account is required for this payment.");

    if (purpose === "designer_subscription") {
      const { data: plan } = await admin
        .from("subscription_plans").select("price").eq("id", referenceId).eq("is_active", true).maybeSingle();
      if (!plan) throw new PaymentError("This subscription plan is not available.");
      return { baseAmount: Number(plan.price), designerId: designer.id };
    }

    const { data: standard } = await admin
      .from("designer_subscriptions").select("status").eq("designer_id", designer.id).maybeSingle();
    if (!standard || (standard.status !== "active" && standard.status !== "trial")) {
      throw new PaymentError("An active Standard subscription is required before buying an AI plan.");
    }
    const { data: aiPlan } = await admin
      .from("ai_subscription_plans").select("price").eq("id", referenceId).eq("is_active", true).maybeSingle();
    if (!aiPlan) throw new PaymentError("This AI plan is not available.");
    return { baseAmount: Number(aiPlan.price), designerId: designer.id };
  }

  if (purpose === "project_payment") {
    const { data: request } = await admin
      .from("project_payment_requests")
      .select("id, project_id, designer_id, amount, status")
      .eq("id", referenceId)
      .maybeSingle();
    if (!request) throw new PaymentError("This payment request was not found.");
    if (request.status === "paid") throw new PaymentError("This payment has already been received.");
    if (request.status === "awaiting_review") {
      throw new PaymentError("This payment is waiting for the designer to confirm it.");
    }
    if (request.status !== "requested") throw new PaymentError("This payment request is not open.");

    const { data: project } = await admin
      .from("customers").select("user_id").eq("id", request.project_id).maybeSingle();
    if (!project || project.user_id !== userId) {
      throw new PaymentError("This payment request is not on your account.");
    }
    const baseAmount = Number(request.amount);
    if (!(baseAmount > 0)) throw new PaymentError("The requested amount is not valid.");
    return { baseAmount, designerId: request.designer_id };
  }

  if (purpose === "wallpaper_order") {
    const { data: customer } = await admin.from("customers").select("id").eq("user_id", userId).maybeSingle();
    const { data: order } = await admin
      .from("wallpaper_orders")
      .select("customer_id, wall_size_length, wall_size_height, wall_unit, wallpaper_type, payment_status")
      .eq("id", referenceId)
      .maybeSingle();
    if (!customer || !order || order.customer_id !== customer.id) {
      throw new PaymentError("This wallpaper order was not found on your account.");
    }
    if (order.payment_status === "completed") throw new PaymentError("This order is already paid.");

    let area = Number(order.wall_size_length) * Number(order.wall_size_height);
    if (order.wall_unit === "inches") area = area / 144;
    const rate = order.wallpaper_type === "golden_foil" ? 220 : 160;
    const advance = round2(area * rate * 0.1);
    if (!(advance > 0)) throw new PaymentError("The wall dimensions on this order are invalid.");
    return { baseAmount: advance, designerId: null };
  }

  const { data: quote } = await admin
    .from("designer_quotes")
    .select("project_id, designer_id, status, payment_status, confirmation_amount")
    .eq("id", referenceId)
    .maybeSingle();
  if (!quote) throw new PaymentError("This quotation was not found.");
  const { data: project } = await admin
    .from("customers").select("user_id").eq("id", quote.project_id).maybeSingle();
  if (!project || project.user_id !== userId) throw new PaymentError("This quotation is not on your account.");
  if (!["sent", "draft", "changes_requested"].includes(quote.status)) {
    throw new PaymentError("This quotation is not awaiting a confirmation payment.");
  }
  if (quote.payment_status === "verified") throw new PaymentError("The advance for this quotation is already paid.");
  const baseAmount = Number(quote.confirmation_amount);
  if (!(baseAmount > 0)) throw new PaymentError("The advance amount for this quotation is not set.");
  return { baseAmount, designerId: quote.designer_id };
}

class PaymentError extends Error {}

async function createPayment(admin: Admin, userId: string, body: any) {
  const purpose = body?.purpose;
  const referenceId = body?.referenceId;
  const method = body?.method;
  if (!PURPOSES.includes(purpose) || !UUID_RE.test(String(referenceId)) || !["razorpay", "upi"].includes(method)) {
    return json({ error: "Invalid payment request." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveOrder(admin, userId, purpose, referenceId);
  } catch (err) {
    if (err instanceof PaymentError) return json({ error: err.message }, 400);
    throw err;
  }

  if (purpose === "project_payment") {
    await admin
      .from("payment_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("purpose", "project_payment")
      .eq("reference_id", referenceId)
      .eq("status", "pending");
  }

  const base = round2(resolved.baseAmount);
  const fee = method === "razorpay" ? round2(base * FEE_RATE) : 0;
  const total = round2(base + fee);
  const paymentOrderId = crypto.randomUUID();

  let razorpayOrderId: string | null = null;
  let razorpayResponse: { orderId: string; keyId: string; amount: number; currency: string } | null = null;

  if (method === "razorpay") {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) throw new Error("Razorpay keys are not configured.");

    const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: paymentOrderId,
        notes: { payment_order_id: paymentOrderId, purpose },
      }),
    });
    if (!rzRes.ok) {
      console.error("Razorpay order creation failed:", rzRes.status, await rzRes.text());
      return json({ error: "Razorpay could not start this payment. Please try again." }, 502);
    }
    const rzOrder = await rzRes.json();
    razorpayOrderId = rzOrder.id;
    razorpayResponse = { orderId: rzOrder.id, keyId, amount: rzOrder.amount, currency: rzOrder.currency };
  }

  const { error: insertError } = await admin.from("payment_orders").insert({
    id: paymentOrderId,
    purpose,
    reference_id: referenceId,
    payer_user_id: userId,
    designer_id: resolved.designerId,
    base_amount: base,
    fee_amount: fee,
    total_amount: total,
    currency: "INR",
    method,
    status: "pending",
    razorpay_order_id: razorpayOrderId,
  });
  if (insertError) throw insertError;

  return json({
    paymentOrderId,
    method,
    baseAmount: base,
    feeAmount: fee,
    totalAmount: total,
    razorpay: razorpayResponse,
    upi: method === "upi" ? { upiId: UPI_ID, payeeName: UPI_PAYEE } : null,
  });
}

async function loadOwnedOrder(admin: Admin, userId: string, paymentOrderId: unknown) {
  if (!UUID_RE.test(String(paymentOrderId))) return null;
  const { data } = await admin
    .from("payment_orders")
    .select("id, method, status, purpose, reference_id, payer_user_id, razorpay_order_id, total_amount")
    .eq("id", paymentOrderId)
    .maybeSingle();
  if (!data || data.payer_user_id !== userId) return null;
  return data;
}

async function submitUpi(admin: Admin, userId: string, body: any) {
  const order = await loadOwnedOrder(admin, userId, body?.paymentOrderId);
  if (!order) return json({ error: "Payment not found." }, 404);
  if (order.method !== "upi") return json({ error: "This payment is not a UPI payment." }, 400);
  if (order.status !== "pending" && order.status !== "rejected") {
    return json({ error: "This payment has already been submitted." }, 400);
  }

  const transactionId = String(body?.transactionId || "").trim();
  if (!TXN_RE.test(transactionId)) {
    return json({ error: "Enter the UPI transaction ID (6 to 30 letters or numbers)." }, 400);
  }

  const screenshotPath = body?.screenshotPath ? String(body.screenshotPath) : null;
  if (screenshotPath && !screenshotPath.startsWith(`${userId}/`)) {
    return json({ error: "Invalid screenshot upload." }, 400);
  }

  const { data: updated, error } = await admin
    .from("payment_orders")
    .update({
      status: "awaiting_review",
      upi_transaction_id: transactionId,
      upi_screenshot_path: screenshotPath,
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .select("purpose, designer_id, reference_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return json({ error: "This UPI transaction ID has already been submitted." }, 409);
    }
    throw error;
  }

  if (updated?.purpose === "project_payment") {
    await admin
      .from("project_payment_requests")
      .update({
        status: "awaiting_review",
        payment_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updated.reference_id)
      .in("status", ["requested", "awaiting_review"]);
  }

  if ((updated?.purpose === "quote_advance" || updated?.purpose === "project_payment") && updated.designer_id) {
    const { data: designer } = await admin.from("designers").select("user_id").eq("id", updated.designer_id).maybeSingle();
    let referenceId = updated.reference_id;
    if (updated.purpose === "project_payment") {
      const { data: request } = await admin
        .from("project_payment_requests")
        .select("project_id")
        .eq("id", updated.reference_id)
        .maybeSingle();
      if (request?.project_id) referenceId = request.project_id;
    }
    if (designer?.user_id) {
      await admin.rpc("create_notification", {
        p_user_id: designer.user_id,
        p_user_type: "designer",
        p_title: updated.purpose === "project_payment" ? "Project payment awaiting review" : "Confirmation payment awaiting review",
        p_message: updated.purpose === "project_payment"
          ? "A homeowner uploaded proof of a project payment. Confirm receipt to apply it to the bill."
          : "A homeowner uploaded proof of the quotation confirmation payment. Confirm receipt before the quotation can be accepted.",
        p_type: "payment_pending_verification",
        p_reference_id: referenceId,
        p_reference_type: updated.purpose === "project_payment" ? "bill" : "quotation",
      });
    }
  }

  return json({ status: "awaiting_review" });
}

async function verifyRazorpay(admin: Admin, userId: string, body: any) {
  const order = await loadOwnedOrder(admin, userId, body?.paymentOrderId);
  if (!order) return json({ error: "Payment not found." }, 404);
  if (order.method !== "razorpay") return json({ error: "This payment is not a Razorpay payment." }, 400);
  if (order.status === "paid") return json({ status: "paid" });

  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keySecret) throw new Error("Razorpay keys are not configured.");

  const paymentId = String(body?.razorpayPaymentId || "");
  const signature = String(body?.razorpaySignature || "");
  const expected = await hmacHex(keySecret, `${order.razorpay_order_id}|${paymentId}`);
  if (!paymentId || signature !== expected) {
    return json({ error: "The payment could not be verified. Please contact support." }, 400);
  }

  const { error } = await admin.rpc("fulfill_payment_order", {
    p_payment_order_id: order.id,
    p_razorpay_payment_id: paymentId,
    p_provider_response: null,
  });
  if (error) throw error;
  if (order.purpose === "project_payment") {
    try {
      await emailCompletedProjectPayment(admin, order.id);
    } catch (emailError) {
      console.error("Payment receipt email failed:", emailError);
    }
  }

  return json({ status: "paid" });
}
