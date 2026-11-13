import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BillItem {
  item_type: string;
  name: string;
  description?: string;
  number_of_units: number;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  amount: number;
  width?: number;
  height?: number;
  depth?: number;
}

interface BillEmailPayload {
  billNumber: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  projectName: string;
  designerName?: string;
  designerSpecialization?: string;
  items: BillItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
}

function formatCurrency(amount: number): string {
  return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getItemTypeLabel(type: string): string {
  switch (type) {
    case 'material': return 'Material';
    case 'labor': return 'Labor';
    case 'service': return 'Service';
    case 'component': return 'Component';
    default: return 'Other';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: BillEmailPayload = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const localSupabase = !Deno.env.get("SUPABASE_URL")?.startsWith("https://");

    if (!RESEND_API_KEY && !localSupabase) {
      throw new Error("RESEND_API_KEY is not configured in Edge Function secrets.");
    }

    if (!payload.customerEmail) {
      throw new Error("Customer email is required to send the bill.");
    }

    const itemRows = payload.items.map((item, i) => {
      const unitsLabel = item.number_of_units > 1 ? ` × ${item.number_of_units}` : '';
      const dims: string[] = [];
      if (item.width) dims.push(`W: ${item.width}`);
      if (item.height) dims.push(`H: ${item.height}`);
      if (item.depth) dims.push(`D: ${item.depth}`);
      const dimStr = dims.length > 0 ? `<br/><span style="font-size:11px;color:#6b7280">${dims.join(' · ')}</span>` : '';
      const descStr = item.description ? `<br/><span style="font-size:11px;color:#6b7280">${item.description}</span>` : '';
      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">
          <strong>${item.name}</strong>${descStr}${dimStr}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px">${getItemTypeLabel(item.item_type)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${Number(item.quantity).toFixed(2)} ${item.unit}${unitsLabel}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right">&#8377; ${formatCurrency(item.unit_price)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right">&#8377; ${formatCurrency(item.amount)}</td>
      </tr>`;
    }).join('');

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0d9488; }
    .header-left h1 { font-size: 24px; color: #0d9488; margin-bottom: 2px; }
    .header-left p { font-size: 13px; color: #6b7280; }
    .header-right { text-align: right; }
    .header-right .bill-num { font-size: 15px; font-weight: 600; }
    .header-right .bill-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .info-box { padding: 14px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px; }
    .info-box p { font-size: 13px; margin-bottom: 2px; }
    .info-box .name { font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    thead { background: #f3f4f6; }
    th { padding: 8px 10px; text-align: left; font-weight: 600; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    .totals { margin-left: auto; width: 260px; margin-bottom: 20px; }
    .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
    .totals .row.total { border-top: 2px solid #0d9488; padding-top: 8px; margin-top: 4px; font-size: 15px; font-weight: 700; color: #0d9488; }
    .totals .row .label { color: #6b7280; }
    .notes { padding: 14px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
    .notes h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    .notes p { font-size: 13px; color: #374151; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>BILL</h1>
      <p>${payload.projectName}</p>
    </div>
    <div class="header-right">
      <div class="bill-num">${payload.billNumber}</div>
      <div class="bill-date">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Bill To</h3>
      <p class="name">${payload.customerName}</p>
      <p>${payload.customerEmail}</p>
      <p>${payload.customerPhone}</p>
      <p>${payload.customerLocation}</p>
    </div>
    ${payload.designerName ? `
    <div class="info-box">
      <h3>From</h3>
      <p class="name">${payload.designerName}</p>
      <p>${payload.designerSpecialization || ''}</p>
    </div>
    ` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:24px">#</th>
        <th>Item</th>
        <th>Type</th>
        <th style="text-align:center">Qty (Unit)</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span class="label">Subtotal</span>
      <span>&#8377; ${formatCurrency(payload.subtotal)}</span>
    </div>
    ${payload.discountAmount > 0 ? `
    <div class="row">
      <span class="label">Discount</span>
      <span style="color:#16a34a">- &#8377; ${formatCurrency(payload.discountAmount)}</span>
    </div>
    ` : ''}
    <div class="row">
      <span class="label">Tax (${payload.taxRate}%)</span>
      <span>&#8377; ${formatCurrency(payload.taxAmount)}</span>
    </div>
    <div class="row total">
      <span>Total</span>
      <span>&#8377; ${formatCurrency(payload.totalAmount)}</span>
    </div>
  </div>

  ${payload.notes ? `
  <div class="notes">
    <h3>Notes</h3>
    <p>${payload.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>This bill was sent by ${payload.designerName || 'your designer'} via The Home Designers platform.</p>
    <p>&copy; ${new Date().getFullYear()} The Home Designers. All rights reserved.</p>
  </div>
</body>
</html>`;

    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "The Home Designers <orders@thehomedesigners.com>",
          to: [payload.customerEmail],
          subject: `Bill ${payload.billNumber} - ${payload.projectName}`,
          html: emailBody,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Resend API error:", JSON.stringify(data));
        throw new Error(`Resend API error: ${JSON.stringify(data)}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Bill email sent successfully", emailId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mailpitBase = Deno.env.get("LOCAL_MAILPIT_URL") || "http://host.docker.internal:54324";
    const mailpitResponse = await fetch(`${mailpitBase}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "orders@thehomedesigners.com", Name: "The Home Designers" },
        To: [{ Email: payload.customerEmail, Name: payload.customerName || payload.customerEmail }],
        Subject: `Bill ${payload.billNumber} - ${payload.projectName}`,
        HTML: emailBody,
      }),
    });

    if (!mailpitResponse.ok) {
      const mailpitError = await mailpitResponse.text();
      throw new Error(`Local email delivery failed: ${mailpitError}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Bill email sent to the local mailbox", local: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending bill email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
