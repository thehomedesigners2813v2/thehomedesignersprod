export async function deliverHtmlEmail(input: {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; warning?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "The Home Designers <orders@thehomedesigners.com>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!resend.ok) {
      console.error("Resend email failed:", await resend.text());
      return { sent: false, warning: "The email could not be sent." };
    }
    return { sent: true };
  }

  const localSupabase = !Deno.env.get("SUPABASE_URL")?.startsWith("https://");
  if (!localSupabase) return { sent: false, warning: "Email is not configured." };

  const mailpitBase = Deno.env.get("LOCAL_MAILPIT_URL") || "http://host.docker.internal:54324";
  const mailpit = await fetch(`${mailpitBase}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: "orders@thehomedesigners.com", Name: "The Home Designers" },
      To: [{ Email: input.to, Name: input.name || input.to }],
      Subject: input.subject,
      HTML: input.html,
    }),
  });
  if (!mailpit.ok) {
    console.error("Local email failed:", await mailpit.text());
    return { sent: false, warning: "The local email could not be sent." };
  }
  return { sent: true };
}

function money(amount: number) {
  return Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Admin = {
  from: (table: string) => any;
};

export async function emailCompletedProjectPayment(admin: Admin, paymentOrderId: string) {
  const { data: order } = await admin
    .from("payment_orders")
    .select("id, purpose, method, base_amount, reference_id, status")
    .eq("id", paymentOrderId)
    .maybeSingle();
  if (!order || order.purpose !== "project_payment" || order.status !== "paid") return;

  const { data: request } = await admin
    .from("project_payment_requests")
    .select("amount, project_id, bill_id, designer_id")
    .eq("id", order.reference_id)
    .maybeSingle();
  if (!request) return;

  const [{ data: project }, { data: bill }, { data: designer }, { data: advances }, { data: paidRequests }] = await Promise.all([
    admin.from("customers").select("name, email, project_name").eq("id", request.project_id).maybeSingle(),
    admin.from("project_bills").select("bill_number, total_amount").eq("id", request.bill_id).maybeSingle(),
    admin.from("designers").select("name, email").eq("id", request.designer_id).maybeSingle(),
    admin.from("quote_advance_payments").select("amount").eq("project_id", request.project_id).eq("status", "paid"),
    admin.from("project_payment_requests").select("amount").eq("project_id", request.project_id).eq("status", "paid"),
  ]);

  const received = (advances || []).reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0)
    + (paidRequests || []).reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0);
  const balance = Math.max(0, Number(bill?.total_amount || 0) - received);
  const method = order.method === "upi" ? "UPI" : "Razorpay";
  const amount = money(Number(request.amount));
  const projectName = project?.project_name || "your project";
  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
  <h2 style="color:#0f766e">Payment received</h2>
  <p>Rs ${amount} was received by ${method} for <strong>${projectName}</strong>.</p>
  <p>Bill ${bill?.bill_number || ""}</p>
  <p>Bill total: Rs ${money(Number(bill?.total_amount || 0))}<br>
  Received: Rs ${money(received)}<br>
  <strong>Balance due: Rs ${money(balance)}</strong></p>
</body></html>`;
  const subject = `Payment received for ${projectName}`;

  if (project?.email) {
    await deliverHtmlEmail({ to: project.email, name: project.name, subject, html });
  }
  if (designer?.email) {
    await deliverHtmlEmail({ to: designer.email, name: designer.name, subject, html });
  }
}
