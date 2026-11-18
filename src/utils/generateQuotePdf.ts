interface QuotePdfItem {
  roomName: string;
  name: string;
  quantity: number;
  unit: string;
  amount: number;
}

interface QuotePdfData {
  quoteNumber: string;
  title: string;
  projectName: string;
  customerName: string;
  items: QuotePdfItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function generateQuotePdf(data: QuotePdfData): void {
  const groups = new Map<string, QuotePdfItem[]>();
  for (const item of data.items) {
    const room = item.roomName.trim() || 'On-Site Work';
    const current = groups.get(room) || [];
    current.push(item);
    groups.set(room, current);
  }

  const rooms = [...groups.entries()].map(([room, roomItems]) => {
    const roomTotal = roomItems.reduce((sum, item) => sum + item.amount, 0);
    const rows = roomItems.map(item => `
      <div class="item">
        <span>${escapeHtml(item.name)}<span class="qty">${item.quantity} ${escapeHtml(item.unit || '')}</span></span>
        <strong>${formatCurrency(item.amount)}</strong>
      </div>
    `).join('');
    return `
      <section class="room">
        <div class="room-head"><span>${escapeHtml(room)}</span><span>${formatCurrency(roomTotal)}</span></div>
        ${rows}
      </section>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Quotation ${escapeHtml(data.quoteNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; color: #3f3a36; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    h1 { margin: 0; font-size: 28px; }
    .meta { margin-top: 6px; color: #6b7280; font-size: 14px; }
    .room { margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .room-head, .item, .line { display: flex; justify-content: space-between; gap: 16px; }
    .room-head { padding: 12px 16px; background: #f9fafb; font-weight: 700; }
    .item { padding: 12px 16px; border-top: 1px solid #f3f4f6; font-size: 14px; }
    .qty { margin-left: 8px; color: #6b7280; font-size: 12px; }
    .totals { margin-top: 20px; margin-left: auto; max-width: 320px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .line { padding: 4px 0; font-size: 14px; }
    .total { margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 18px; font-weight: 700; }
    .total strong { color: #b5533a; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <p class="meta">Quotation ${escapeHtml(data.quoteNumber)} · ${escapeHtml(data.projectName)}</p>
  <h1>${escapeHtml(data.title || 'Untitled quotation')}</h1>
  <p class="meta">Prepared for ${escapeHtml(data.customerName)}</p>
  ${rooms}
  <div class="totals">
    <div class="line"><span>Subtotal</span><strong>${formatCurrency(data.subtotal)}</strong></div>
    <div class="line"><span>Discount</span><strong>- ${formatCurrency(data.discountAmount)}</strong></div>
    <div class="line"><span>Tax (${data.taxRate}%)</span><strong>${formatCurrency(data.taxAmount)}</strong></div>
    <div class="line total"><span>Total</span><strong>${formatCurrency(data.totalAmount)}</strong></div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 300);
}
