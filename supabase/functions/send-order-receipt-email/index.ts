import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderReceiptPayload {
  orderId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  wallSizeLength: number;
  wallSizeHeight: number;
  wallUnit: string;
  wallpaperType: string;
  ratePerSqft: number;
  totalAreaSqft: number;
  totalAmount: number;
  advanceAmount: number;
  orderDate: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: OrderReceiptPayload = await req.json();

    console.log("Received email request for order:", payload.orderId);
    console.log("Customer email:", payload.customerEmail);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured in Edge Function secrets");
      throw new Error("RESEND_API_KEY is not configured. Please add it to your Supabase Edge Function secrets.");
    }

    const wallpaperTypeDisplay = payload.wallpaperType === "golden_foil"
      ? "Golden Foil 3D Wallpaper"
      : "Normal 3D Wallpaper";

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .order-details {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
    }
    .detail-value {
      color: #111827;
    }
    .highlight {
      background: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
    }
    .amount {
      font-size: 24px;
      font-weight: bold;
      color: #059669;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Order Receipt</h1>
    <p>Thank you for your 3D wallpaper order!</p>
  </div>

  <div class="content">
    <p>Dear ${payload.customerName},</p>

    <p>We have received your 3D wallpaper order. Here are the details:</p>

    <div class="order-details">
      <h3 style="margin-top: 0; color: #111827;">Order Information</h3>

      <div class="detail-row">
        <span class="detail-label">Order ID:</span>
        <span class="detail-value">${payload.orderId}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Order Date:</span>
        <span class="detail-value">${new Date(payload.orderDate).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Wallpaper Type:</span>
        <span class="detail-value">${wallpaperTypeDisplay}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Wall Dimensions:</span>
        <span class="detail-value">${payload.wallSizeLength} x ${payload.wallSizeHeight} ${payload.wallUnit}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Total Area:</span>
        <span class="detail-value">${payload.totalAreaSqft} sq ft</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Rate per sq ft:</span>
        <span class="detail-value">₹${payload.ratePerSqft}</span>
      </div>

      <div class="detail-row" style="border-bottom: none;">
        <span class="detail-label">Total Amount:</span>
        <span class="amount">₹${payload.totalAmount}</span>
      </div>
    </div>

    <div class="highlight">
      <strong>Advance Payment Required:</strong> ₹${payload.advanceAmount} (50% of total amount)
    </div>

    <div class="order-details">
      <h3 style="margin-top: 0; color: #111827;">Delivery Address</h3>
      <p style="margin: 0;">${payload.customerAddress}</p>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #eff6ff; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #1e40af;">Next Steps:</h3>
      <ol style="margin: 0; padding-left: 20px;">
        <li>Our team will review your order and contact you shortly</li>
        <li>We will provide a preview design for your approval</li>
        <li>After preview confirmation, proceed with the advance payment</li>
        <li>Production will begin after payment verification</li>
      </ol>
    </div>

    <p style="margin-top: 30px;">If you have any questions, please contact us at:</p>
    <p style="margin: 5px 0;"><strong>Phone:</strong> ${payload.customerPhone}</p>
  </div>

  <div class="footer">
    <p>This is an automated email. Please do not reply to this email.</p>
    <p>&copy; ${new Date().getFullYear()} The Home Designers. All rights reserved.</p>
  </div>
</body>
</html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "The Home Designers <orders@thehomedesigners.in>",
        to: [payload.customerEmail],
        subject: `3D Wallpaper Order Receipt - Order #${payload.orderId.substring(0, 8)}`,
        html: emailBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", JSON.stringify(data));
      throw new Error(`Resend API error: ${JSON.stringify(data)}`);
    }

    console.log("Email sent successfully! Email ID:", data.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order receipt email sent successfully",
        emailId: data.id
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending order receipt email:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
