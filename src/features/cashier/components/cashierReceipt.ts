import type { Order, RestaurantSettings } from "@/lib/types";

export interface ReceiptPaymentLine {
  method: "cash" | "card" | "wallet" | "other";
  amount: number;
  tendered?: number;
}

export interface ReceiptData {
  order: Order;
  settings: RestaurantSettings | null;
  payments: ReceiptPaymentLine[];
  amountPaid: number;
  change: number;
  language: "ar" | "en";
}

export const RECEIPT_PAPER_WIDTH_MM = 80;

const METHOD_LABEL: Record<ReceiptPaymentLine["method"], { ar: string; en: string }> = {
  cash: { ar: "كاش", en: "Cash" },
  card: { ar: "كارت", en: "Card" },
  wallet: { ar: "محفظة", en: "Wallet" },
  other: { ar: "أخرى", en: "Other" },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(n: number, language: "ar" | "en"): string {
  const symbol = language === "ar" ? "ج.م" : "EGP";
  return `${n.toLocaleString(language === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

function formatDateTime(iso: string, language: "ar" | "en"): string {
  return new Date(iso).toLocaleString(language === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build the full HTML document for a thermal-printable receipt.
 *
 * Sized for ${RECEIPT_PAPER_WIDTH_MM}mm thermal paper with variable height —
 * @page sets the physical paper, the .receipt container centers itself within
 * that width so the content doesn't bleed into the printer margins.
 *
 * The .no-print rule hides anything outside the receipt root when sent to a
 * printer, even though we always render this in a dedicated popup window.
 */
export function buildReceiptHtml(data: ReceiptData): string {
  const { order, settings, payments, amountPaid, change, language } = data;
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const restaurantName = settings
    ? isAr
      ? settings.nameAr || settings.nameEn
      : settings.nameEn || settings.nameAr
    : isAr
      ? "Tasty Table"
      : "Tasty Table";

  const logoUrl = settings?.logoUrl || "";

  const items = order.items
    .map((item) => {
      const name = isAr ? item.nameAr : item.nameEn;
      const variantLine = item.variant
        ? `<div class="muted" style="font-size:9pt">${escapeHtml(item.variant)}</div>`
        : "";
      const notesLine = item.notes
        ? `<div class="muted" style="font-size:9pt">${escapeHtml(item.notes)}</div>`
        : "";
      const lineTotal = item.unitPrice * item.quantity;
      return `
        <div class="item">
          <div class="item-row">
            <span class="qty">${item.quantity}×</span>
            <span class="name">${escapeHtml(name)}</span>
            <span class="price">${formatMoney(lineTotal, language)}</span>
          </div>
          ${variantLine}
          ${notesLine}
        </div>`;
    })
    .join("");

  const discountRow =
    order.discountAmount > 0
      ? `<div class="line"><span>${isAr ? "الخصم" : "Discount"}</span><span>−${formatMoney(order.discountAmount, language)}</span></div>`
      : "";

  const taxRow =
    order.taxAmount > 0
      ? `<div class="line"><span>${isAr ? "الضريبة" : "Tax"} (${(order.taxRate * 100).toFixed(1)}%)</span><span>${formatMoney(order.taxAmount, language)}</span></div>`
      : "";

  const serviceRow =
    order.serviceAmount > 0
      ? `<div class="line"><span>${isAr ? "رسوم الخدمة" : "Service"} (${(order.serviceRate * 100).toFixed(1)}%)</span><span>${formatMoney(order.serviceAmount, language)}</span></div>`
      : "";

  const paymentsRows = payments
    .map((p) => {
      const label = METHOD_LABEL[p.method]?.[language] || p.method;
      const tendered =
        p.method === "cash" && p.tendered && p.tendered !== p.amount
          ? `<span class="muted" style="font-size:9pt">(${isAr ? "مقدم" : "tendered"}: ${formatMoney(p.tendered, language)})</span>`
          : "";
      return `<div class="pay-line">
        <span>${escapeHtml(label)} ${tendered}</span>
        <span>${formatMoney(p.amount, language)}</span>
      </div>`;
    })
    .join("");

  const changeRow =
    change > 0.005
      ? `<div class="line bold"><span>${isAr ? "الباقي" : "Change"}</span><span>${formatMoney(change, language)}</span></div>`
      : "";

  const remainingRow =
    order.total - order.paidTotal > 0.01
      ? `<div class="line bold"><span>${isAr ? "المتبقي" : "Remaining"}</span><span>${formatMoney(order.total - order.paidTotal, language)}</span></div>`
      : "";

  const phoneLine = settings?.contactPhone
    ? `<div class="muted" style="font-size:9pt">${escapeHtml(settings.contactPhone)}</div>`
    : "";
  const addressLine = settings?.contactAddress
    ? `<div class="muted" style="font-size:9pt">${escapeHtml(settings.contactAddress)}</div>`
    : "";

  const logo = logoUrl
    ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(restaurantName)}" onerror="this.style.display='none'"/>`
    : "";

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head>
<meta charset="UTF-8">
<title>${isAr ? "فاتورة" : "Receipt"} #${escapeHtml(order.orderNumber)}</title>
<style>
  /* Thermal ${RECEIPT_PAPER_WIDTH_MM}mm paper, variable height. The content
     container is centered within the printable width so it doesn't bleed
     past the physical paper boundary. */
  @page {
    size: ${RECEIPT_PAPER_WIDTH_MM}mm auto;
    margin: 0;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: ${RECEIPT_PAPER_WIDTH_MM}mm;
    background: #fff;
    color: #000;
    font-family: 'Segoe UI', 'Noto Naskh Arabic', 'Tahoma', sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { padding: 4mm 4mm 6mm; }
  .receipt { width: 100%; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .muted { color: #444; }
  .divider {
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  .divider-thick {
    border-top: 1px solid #000;
    margin: 4px 0;
  }
  .logo {
    display: block;
    margin: 0 auto 4px;
    max-width: 40mm;
    max-height: 18mm;
    object-fit: contain;
  }
  .name {
    font-size: 13pt;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .meta {
    font-size: 9pt;
    color: #333;
    margin-bottom: 2px;
  }
  .item {
    margin: 2px 0;
  }
  .item-row {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    align-items: baseline;
  }
  .item .qty { font-weight: 600; }
  .item .name { flex: 1; }
  .item .price { font-weight: 600; white-space: nowrap; }
  .line {
    display: flex;
    justify-content: space-between;
    margin: 1px 0;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 12pt;
    font-weight: 700;
    margin: 4px 0;
  }
  .pay-line {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin: 1px 0;
  }
  .footer {
    margin-top: 6px;
    text-align: center;
    font-size: 9pt;
    color: #444;
  }
  @media print {
    /* No app chrome should leak into the receipt window. The popup already
       contains only the receipt root, but be defensive in case the doc is
       ever inlined elsewhere. */
    body > *:not(.receipt) { display: none !important; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="center">
    ${logo}
    <div class="name">${escapeHtml(restaurantName)}</div>
    ${phoneLine}
    ${addressLine}
  </div>

  <div class="divider"></div>

  <div class="meta center">${isAr ? "فاتورة" : "Receipt"} #${escapeHtml(order.orderNumber)}</div>
  <div class="meta center">${formatDateTime(order.createdAt, language)}</div>

  <div class="divider"></div>

  <div class="line"><span>${isAr ? "الزبون" : "Customer"}</span><span>${escapeHtml(order.customerName)}</span></div>
  ${order.phone ? `<div class="line"><span>${isAr ? "الهاتف" : "Phone"}</span><span>${escapeHtml(order.phone)}</span></div>` : ""}
  <div class="line"><span>${isAr ? "النوع" : "Type"}</span><span>${order.orderType === "dine_in" ? (isAr ? "صالة" : "Dine-in") : (isAr ? "تيك أواي" : "Takeaway")}${order.tableNumber ? ` — ${isAr ? "طاولة" : "Table"} ${order.tableNumber}` : ""}</span></div>

  <div class="divider"></div>

  ${items}

  <div class="divider-thick"></div>

  <div class="line"><span>${isAr ? "المجموع الفرعي" : "Subtotal"}</span><span>${formatMoney(order.itemsTotal, language)}</span></div>
  ${discountRow}
  ${taxRow}
  ${serviceRow}

  <div class="divider-thick"></div>

  <div class="total-row"><span>${isAr ? "الإجمالي" : "Total"}</span><span>${formatMoney(order.total, language)}</span></div>

  ${remainingRow}

  <div class="divider"></div>

  <div class="bold" style="margin:2px 0">${isAr ? "الدفع" : "Payment"}</div>
  ${paymentsRows}
  <div class="line bold"><span>${isAr ? "المدفوع" : "Paid"}</span><span>${formatMoney(amountPaid, language)}</span></div>
  ${changeRow}

  <div class="divider"></div>

  <div class="footer">
    ${isAr ? "شكراً لزيارتكم" : "Thank you for your visit"}
  </div>
</div>

<script>
  // Auto-trigger the print dialog once the doc is parsed. Some browsers
  // ignore <script> at the bottom if images haven't started loading; we
  // wait on window.load so layout is stable for ${RECEIPT_PAPER_WIDTH_MM}mm
  // paper. Users can also re-trigger with Ctrl/Cmd+P.
  window.addEventListener('load', function () {
    try { window.print(); } catch (e) { /* user can print manually */ }
  });
</script>
</body>
</html>`;
}

/**
 * Open a popup window and write the receipt HTML, then trigger the browser
 * print dialog. Popup-blocked callers will see a toast instructing them to
 * allow popups for the cashier page.
 */
export function openReceiptPrint(data: ReceiptData): boolean {
  if (typeof window === "undefined") return false;
  const html = buildReceiptHtml(data);
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
