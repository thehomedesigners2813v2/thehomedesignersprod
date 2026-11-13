import { createClient } from "npm:@supabase/supabase-js@2";
import { deliverHtmlEmail } from "../_shared/projectPaymentEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const round2 = (n: number) => Math.round(n * 100) / 100;

function money(amount: number) {
  return Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    const body = await req.json();
    const billId = String(body?.billId || "");
    const amount = round2(Number(body?.amount));
    const note = body?.note ? String(body.note).trim().slice(0, 500) : null;
    if (!/^[0-9a-f-]{36}$/i.test(billId) || !(amount > 0)) {
      return json({ error: "Enter a valid payment amount." }, 400);
    }

    const { data: designer } = await admin
      .from("designers")
      .select("id, name")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!designer) return json({ error: "A designer account is required to request a payment." }, 403);

    const { data: bill } = await admin
      .from("project_bills")
      .select("id, project_id, designer_id, bill_number, total_amount, status")
      .eq("id", billId)
      .maybeSingle();
    if (!bill || bill.designer_id !== designer.id) {
      return json({ error: "This bill was not found on your account." }, 404);
    }
    if (!bill.project_id) return json({ error: "This bill is not linked to a project." }, 400);

    const { data: openRequest } = await admin
      .from("project_payment_requests")
      .select("id")
      .eq("bill_id", bill.id)
      .in("status", ["requested", "awaiting_review"])
      .maybeSingle();
    if (openRequest) {
      return json({ error: "A payment request is already open for this bill." }, 409);
    }

    const { data: advances } = await admin
      .from("quote_advance_payments")
      .select("amount")
      .eq("project_id", bill.project_id)
      .eq("status", "paid");
    const { data: paidRequests } = await admin
      .from("project_payment_requests")
      .select("amount")
      .eq("project_id", bill.project_id)
      .eq("status", "paid");
    const received = round2(
      (advances || []).reduce((sum, row) => sum + Number(row.amount), 0) +
      (paidRequests || []).reduce((sum, row) => sum + Number(row.amount), 0),
    );
    const balance = round2(Number(bill.total_amount) - received);
    if (amount - balance > 0.01) {
      return json({ error: `The amount cannot be more than the balance of Rs ${money(Math.max(balance, 0))}.` }, 400);
    }

    const { data: project } = await admin
      .from("customers")
      .select("user_id, name, email, project_name")
      .eq("id", bill.project_id)
      .maybeSingle();
    if (!project?.email) return json({ error: "This project has no customer email." }, 400);

    const { data: created, error: insertError } = await admin
      .from("project_payment_requests")
      .insert({
        bill_id: bill.id,
        project_id: bill.project_id,
        designer_id: designer.id,
        amount,
        note,
        status: "requested",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    if (project.user_id) {
      await admin.rpc("create_notification", {
        p_user_id: project.user_id,
        p_user_type: "customer",
        p_title: "Payment requested",
        p_message: `${designer.name || "Your designer"} requested Rs ${money(amount)} for "${project.project_name || "your project"}". Open the project bill to pay.`,
        p_type: "project_payment_requested",
        p_reference_id: bill.project_id,
        p_reference_type: "bill",
      });
    }

    const localSupabase = !Deno.env.get("SUPABASE_URL")?.startsWith("https://");
    const payLink = `${localSupabase ? "http://localhost:5173" : "https://thehomedesigners.com"}/my-bill/${bill.project_id}`;
    const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
  <h2 style="color:#0f766e">Payment requested</h2>
  <p>${designer.name || "Your designer"} has asked for the next payment on <strong>${project.project_name || "your project"}</strong>.</p>
  <p style="font-size:20px"><strong>Rs ${money(amount)}</strong></p>
  ${note ? `<p>${note.replace(/</g, "&lt;")}</p>` : ""}
  <p>Bill ${bill.bill_number || ""} · Balance before this request: Rs ${money(Math.max(balance, 0))}</p>
  <p><a href="${payLink}">Open the project bill and pay</a></p>
</body></html>`;

    const delivery = await deliverHtmlEmail({
      to: project.email,
      name: project.name,
      subject: `Payment request of Rs ${money(amount)} for ${project.project_name || "your project"}`,
      html,
    });

    return json({
      success: true,
      requestId: created.id,
      emailWarning: delivery.sent ? undefined : `The request was saved, but ${delivery.warning || "the email could not be sent."}`,
    });
  } catch (err) {
    console.error("send-payment-request-email error:", err);
    return json({ error: "The payment request could not be saved." }, 500);
  }
});
