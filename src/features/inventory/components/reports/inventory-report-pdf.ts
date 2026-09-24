import type { InventoryItem, StockMovement } from "@/lib/inventory-types";
import { formatPrice } from "@/lib/utils";

const REPORT_STYLES = `
  @page { margin: 15mm 20mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif; font-size:10pt; color:#000; background:#fff; direction:rtl; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { padding:6px 10px; font-size:9pt; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #999; text-align:right; background:#f3f4f6; }
  td { padding:6px 10px; font-size:10pt; color:#111; border-bottom:1px solid #e5e7eb; }
  tr:last-child td { border-bottom:none; }
  .kpi-row { display:flex; gap:20px; margin-bottom:20px; flex-wrap:wrap; }
  .kpi-box { flex:1; min-width:140px; border:1px solid #d1d5db; border-radius:8px; padding:12px 16px; text-align:center; }
  .kpi-label { font-size:9pt; color:#6b7280; margin-bottom:4px; }
  .kpi-value { font-size:14pt; font-weight:700; color:#111; }
  .kpi-value.green { color:#059669; }
  .kpi-value.yellow { color:#d97706; }
  .kpi-value.red { color:#dc2626; }
  .kpi-value.blue { color:#2563eb; }
  .status-badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:8pt; font-weight:600; }
  .status-instock { background:#d1fae5; color:#065f46; }
  .status-low { background:#fef3c7; color:#92400e; }
  .status-critical { background:#fed7aa; color:#9a3412; }
  .status-out { background:#fee2e2; color:#991b1b; }
  .footer { border-top:1px solid #ccc; padding-top:8px; text-align:center; font-size:8pt; color:#666; margin-top:24px; }
  @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`;

function wrapHtml(title: string, content: string, lang: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
${content}
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

function getStatusBadge(qty: number, reorderPoint: number, minQty: number, isArabic: boolean): string {
  if (qty === 0) return `<span class="status-badge status-out">${isArabic ? "نفذ" : "Out"}</span>`;
  if (qty <= minQty) return `<span class="status-badge status-critical">${isArabic ? "حرج" : "Critical"}</span>`;
  if (qty <= reorderPoint) return `<span class="status-badge status-low">${isArabic ? "منخفض" : "Low"}</span>`;
  return `<span class="status-badge status-instock">${isArabic ? "متوفر" : "In Stock"}</span>`;
}

function getMovementTypeLabel(type: string, isArabic: boolean): string {
  const labels: Record<string, { ar: string; en: string }> = {
    initial: { ar: "جرد أولي", en: "Opening" },
    purchase: { ar: "مشتريات", en: "Purchase" },
    sale: { ar: "بيع", en: "Sale" },
    consumption: { ar: "استهلاك", en: "Consumption" },
    waste: { ar: "هالك", en: "Waste" },
    damage: { ar: "تلف", en: "Damage" },
    expired: { ar: "منتهي الصلاحية", en: "Expired" },
    adjustment_up: { ar: "زيادة", en: "Adjust +" },
    adjustment_down: { ar: "نقص", en: "Adjust -" },
    return: { ar: "مرتجع", en: "Return" },
  };
  const label = labels[type] || { ar: type, en: type };
  return isArabic ? label.ar : label.en;
}

// ─── All Items Report ───

export function generateAllItemsReportHtml(
  items: InventoryItem[],
  summary: { totalItems: number; totalValue: number; inStock: number; lowStock: number; outOfStock: number },
  isArabic: boolean,
): string {
  const lang = isArabic ? "ar" : "en";
  const title = isArabic ? "تقرير جميع عناصر المخزون" : "All Inventory Items Report";
  const now = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" });

  const kpis = `
    <div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "إجمالي العناصر" : "Total Items"}</div><div class="kpi-value blue">${summary.totalItems}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "قيمة المخزون" : "Inventory Value"}</div><div class="kpi-value green">${formatPrice(summary.totalValue, isArabic ? "ar" : "en")}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "متوفر" : "In Stock"}</div><div class="kpi-value green">${summary.inStock}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "منخفض" : "Low Stock"}</div><div class="kpi-value yellow">${summary.lowStock}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "نفذ" : "Out of Stock"}</div><div class="kpi-value red">${summary.outOfStock}</div></div>
    </div>`;

  const rows = items.length
    ? items.map((item, i) => {
        const qty = Number(item.qtyOnHand);
        const cost = Number(item.avgUnitCost);
        const value = qty * cost;
        return `<tr>
          <td style="text-align:center;width:35px">${i + 1}</td>
          <td style="text-align:right;font-weight:600">${isArabic ? item.nameAr : item.nameEn}</td>
          <td style="text-align:center;color:#666">${item.code || "-"}</td>
          <td style="text-align:center">${item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}</td>
          <td style="text-align:center;font-weight:600">${qty} ${item.unit}</td>
          <td style="text-align:center">${formatPrice(cost, isArabic ? "ar" : "en")}</td>
          <td style="text-align:center;font-weight:600">${formatPrice(value, isArabic ? "ar" : "en")}</td>
          <td style="text-align:center">${getStatusBadge(qty, Number(item.reorderPoint), Number(item.minQty), isArabic)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="8" style="padding:20px;text-align:center;color:#888">${isArabic ? "لا توجد بيانات" : "No data"}</td></tr>`;

  const totalValue = items.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0);

  const content = `
    <h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">${title}</h1>
    <p style="font-size:9pt;color:#666;margin-bottom:16px">${isArabic ? "آخر تحديث:" : "Last updated:"} ${now}</p>
    <div style="border-bottom:2px solid #999;margin-bottom:16px"></div>
    ${kpis}
    <table style="border:1px solid #d1d5db">
      <thead>
        <tr>
          <th style="text-align:center;width:35px">#</th>
          <th style="text-align:right">${isArabic ? "العنصر" : "Item"}</th>
          <th style="text-align:center">${isArabic ? "الكود" : "Code"}</th>
          <th style="text-align:center">${isArabic ? "الفئة" : "Category"}</th>
          <th style="text-align:center">${isArabic ? "الكمية" : "Qty"}</th>
          <th style="text-align:center">${isArabic ? "تكلفة الوحدة" : "Unit Cost"}</th>
          <th style="text-align:center">${isArabic ? "القيمة" : "Value"}</th>
          <th style="text-align:center">${isArabic ? "الحالة" : "Status"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="font-weight:700;border-top:2px solid #999">
          <td colspan="4" style="text-align:right">${isArabic ? "الإجمالي" : "Total"}</td>
          <td style="text-align:center">${items.reduce((s, i) => s + Number(i.qtyOnHand), 0)}</td>
          <td></td>
          <td style="text-align:center;font-weight:700">${formatPrice(totalValue, isArabic ? "ar" : "en")}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">${title} - Tasty Table</div>`;

  return wrapHtml(title, content, lang);
}

// ─── Low Stock Report ───

export function generateLowStockReportHtml(
  items: InventoryItem[],
  summary: { totalItems: number; totalValue: number; criticalCount: number },
  isArabic: boolean,
): string {
  const lang = isArabic ? "ar" : "en";
  const title = isArabic ? "تقرير المخزون المنخفض" : "Low Stock Report";
  const now = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" });

  const kpis = `
    <div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "عناصر منخفضة" : "Low Stock Items"}</div><div class="kpi-value yellow">${summary.totalItems}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "قيمة المخزون المنخفض" : "Low Stock Value"}</div><div class="kpi-value yellow">${formatPrice(summary.totalValue, isArabic ? "ar" : "en")}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "حرج" : "Critical"}</div><div class="kpi-value red">${summary.criticalCount}</div></div>
    </div>`;

  const rows = items.length
    ? items.map((item, i) => {
        const qty = Number(item.qtyOnHand);
        const isCritical = qty <= Number(item.minQty);
        return `<tr>
          <td style="text-align:center;width:35px">${i + 1}</td>
          <td style="text-align:right;font-weight:600">${isArabic ? item.nameAr : item.nameEn}</td>
          <td style="text-align:center">${item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}</td>
          <td style="text-align:center;font-weight:600">${qty} ${item.unit}</td>
          <td style="text-align:center">${Number(item.reorderPoint)}</td>
          <td style="text-align:center">${Number(item.minQty)}</td>
          <td style="text-align:center">
            <span class="status-badge ${isCritical ? "status-critical" : "status-low"}">
              ${isCritical ? (isArabic ? "حرج" : "Critical") : (isArabic ? "منخفض" : "Low")}
            </span>
          </td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="7" style="padding:20px;text-align:center;color:#888">${isArabic ? "لا توجد عناصر منخفضة" : "No low stock items"}</td></tr>`;

  const content = `
    <h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">${title}</h1>
    <p style="font-size:9pt;color:#666;margin-bottom:16px">${isArabic ? "آخر تحديث:" : "Last updated:"} ${now}</p>
    <div style="border-bottom:2px solid #999;margin-bottom:16px"></div>
    ${kpis}
    <table style="border:1px solid #d1d5db">
      <thead>
        <tr>
          <th style="text-align:center;width:35px">#</th>
          <th style="text-align:right">${isArabic ? "العنصر" : "Item"}</th>
          <th style="text-align:center">${isArabic ? "الفئة" : "Category"}</th>
          <th style="text-align:center">${isArabic ? "الكمية" : "Qty"}</th>
          <th style="text-align:center">${isArabic ? "نقطة إعادة الطلب" : "Reorder Pt"}</th>
          <th style="text-align:center">${isArabic ? "الحد الأدنى" : "Min Qty"}</th>
          <th style="text-align:center">${isArabic ? "الحالة" : "Status"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${title} - Tasty Table</div>`;

  return wrapHtml(title, content, lang);
}

// ─── Out of Stock Report ───

export function generateOutOfStockReportHtml(
  items: InventoryItem[],
  isArabic: boolean,
): string {
  const lang = isArabic ? "ar" : "en";
  const title = isArabic ? "تقرير نفاد المخزون" : "Out of Stock Report";
  const now = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" });

  const kpis = `
    <div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "عناصر منتهية" : "Out of Stock Items"}</div><div class="kpi-value red">${items.length}</div></div>
    </div>`;

  const rows = items.length
    ? items.map((item, i) => `<tr>
        <td style="text-align:center;width:35px">${i + 1}</td>
        <td style="text-align:right;font-weight:600">${isArabic ? item.nameAr : item.nameEn}</td>
        <td style="text-align:center;color:#666">${item.code || "-"}</td>
        <td style="text-align:center">${item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}</td>
        <td style="text-align:center;font-weight:600">0 ${item.unit}</td>
        <td style="text-align:center">
          <span class="status-badge status-out">${isArabic ? "نفذ" : "Out"}</span>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="padding:20px;text-align:center;color:#888">${isArabic ? "جميع العناصر متوفرة" : "All items are in stock"}</td></tr>`;

  const content = `
    <h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">${title}</h1>
    <p style="font-size:9pt;color:#666;margin-bottom:16px">${isArabic ? "آخر تحديث:" : "Last updated:"} ${now}</p>
    <div style="border-bottom:2px solid #999;margin-bottom:16px"></div>
    ${kpis}
    <table style="border:1px solid #d1d5db">
      <thead>
        <tr>
          <th style="text-align:center;width:35px">#</th>
          <th style="text-align:right">${isArabic ? "العنصر" : "Item"}</th>
          <th style="text-align:center">${isArabic ? "الكود" : "Code"}</th>
          <th style="text-align:center">${isArabic ? "الفئة" : "Category"}</th>
          <th style="text-align:center">${isArabic ? "الكمية" : "Qty"}</th>
          <th style="text-align:center">${isArabic ? "الحالة" : "Status"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${title} - Tasty Table</div>`;

  return wrapHtml(title, content, lang);
}

// ─── Full Summary Report ───

export function generateSummaryReportHtml(
  items: InventoryItem[],
  summary: {
    totalItems: number;
    totalValue: number;
    inStockCount: number;
    inStockValue: number;
    lowStockCount: number;
    lowStockValue: number;
    outOfStockCount: number;
  },
  isArabic: boolean,
): string {
  const lang = isArabic ? "ar" : "en";
  const title = isArabic ? "ملخص المخزون الشامل" : "Full Inventory Summary";
  const now = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" });

  const kpis = `
    <div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "إجمالي العناصر" : "Total Items"}</div><div class="kpi-value blue">${summary.totalItems}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "قيمة المخزون الكلية" : "Total Value"}</div><div class="kpi-value green">${formatPrice(summary.totalValue, isArabic ? "ar" : "en")}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "متوفر" : "In Stock"}</div><div class="kpi-value green">${summary.inStockCount} — ${formatPrice(summary.inStockValue, isArabic ? "ar" : "en")}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "منخفض" : "Low Stock"}</div><div class="kpi-value yellow">${summary.lowStockCount} — ${formatPrice(summary.lowStockValue, isArabic ? "ar" : "en")}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "نفذ" : "Out of Stock"}</div><div class="kpi-value red">${summary.outOfStockCount}</div></div>
    </div>`;

  const rows = items.length
    ? items.map((item, i) => {
        const qty = Number(item.qtyOnHand);
        const cost = Number(item.avgUnitCost);
        const value = qty * cost;
        return `<tr>
          <td style="text-align:center;width:35px">${i + 1}</td>
          <td style="text-align:right;font-weight:600">${isArabic ? item.nameAr : item.nameEn}</td>
          <td style="text-align:center">${item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}</td>
          <td style="text-align:center;font-weight:600">${qty} ${item.unit}</td>
          <td style="text-align:center">${formatPrice(cost, isArabic ? "ar" : "en")}</td>
          <td style="text-align:center;font-weight:600">${formatPrice(value, isArabic ? "ar" : "en")}</td>
          <td style="text-align:center">${getStatusBadge(qty, Number(item.reorderPoint), Number(item.minQty), isArabic)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="7" style="padding:20px;text-align:center;color:#888">${isArabic ? "لا توجد بيانات" : "No data"}</td></tr>`;

  const content = `
    <h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">${title}</h1>
    <p style="font-size:9pt;color:#666;margin-bottom:16px">${isArabic ? "آخر تحديث:" : "Last updated:"} ${now}</p>
    <div style="border-bottom:2px solid #999;margin-bottom:16px"></div>
    ${kpis}
    <table style="border:1px solid #d1d5db">
      <thead>
        <tr>
          <th style="text-align:center;width:35px">#</th>
          <th style="text-align:right">${isArabic ? "العنصر" : "Item"}</th>
          <th style="text-align:center">${isArabic ? "الفئة" : "Category"}</th>
          <th style="text-align:center">${isArabic ? "الكمية" : "Qty"}</th>
          <th style="text-align:center">${isArabic ? "تكلفة الوحدة" : "Unit Cost"}</th>
          <th style="text-align:center">${isArabic ? "القيمة" : "Value"}</th>
          <th style="text-align:center">${isArabic ? "الحالة" : "Status"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="font-weight:700;border-top:2px solid #999">
          <td colspan="3" style="text-align:right">${isArabic ? "الإجمالي" : "Total"}</td>
          <td style="text-align:center">${items.reduce((s, i) => s + Number(i.qtyOnHand), 0)}</td>
          <td></td>
          <td style="text-align:center;font-weight:700">${formatPrice(summary.totalValue, isArabic ? "ar" : "en")}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">${title} - Tasty Table</div>`;

  return wrapHtml(title, content, lang);
}

// ─── Stock Movements Report ───

export function generateMovementsReportHtml(
  movements: (StockMovement & { inventoryItem?: { nameAr: string; nameEn: string; code?: string; unit?: string } })[],
  total: number,
  isArabic: boolean,
): string {
  const lang = isArabic ? "ar" : "en";
  const title = isArabic ? "تقرير حركات المخزون" : "Stock Movements Report";
  const now = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" });

  const kpis = `
    <div class="kpi-row">
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "إجمالي الحركات" : "Total Movements"}</div><div class="kpi-value blue">${total}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "حركات الإضافة" : "Inbound"}</div><div class="kpi-value green">${movements.filter((m) => Number(m.quantity) > 0).length}</div></div>
      <div class="kpi-box"><div class="kpi-label">${isArabic ? "حركات السحب" : "Outbound"}</div><div class="kpi-value red">${movements.filter((m) => Number(m.quantity) < 0).length}</div></div>
    </div>`;

  const rows = movements.length
    ? movements.map((mov, i) => {
        const qty = Number(mov.quantity);
        const dateStr = new Date(mov.createdAt).toLocaleString(isArabic ? "ar-EG" : "en-US", {
          timeZone: "Africa/Cairo",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<tr>
          <td style="text-align:center;width:35px">${i + 1}</td>
          <td style="text-align:right;white-space:nowrap">${dateStr}</td>
          <td style="text-align:center">${getMovementTypeLabel(mov.type, isArabic)}</td>
          <td style="text-align:right;font-weight:600">${mov.inventoryItem ? (isArabic ? mov.inventoryItem.nameAr : mov.inventoryItem.nameEn) : "-"}</td>
          <td style="text-align:center;font-weight:600;color:${qty > 0 ? "#059669" : "#dc2626"}">${qty > 0 ? "+" : ""}${qty} ${mov.unit}</td>
          <td style="text-align:center">${Number(mov.qtyBefore)}</td>
          <td style="text-align:center">${Number(mov.qtyAfter)}</td>
          <td style="text-align:center;color:#666;font-size:9pt">${mov.reason || "-"}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="8" style="padding:20px;text-align:center;color:#888">${isArabic ? "لا توجد حركات" : "No movements"}</td></tr>`;

  const content = `
    <h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">${title}</h1>
    <p style="font-size:9pt;color:#666;margin-bottom:16px">${isArabic ? "آخر تحديث:" : "Last updated:"} ${now}</p>
    <div style="border-bottom:2px solid #999;margin-bottom:16px"></div>
    ${kpis}
    <table style="border:1px solid #d1d5db">
      <thead>
        <tr>
          <th style="text-align:center;width:35px">#</th>
          <th style="text-align:right">${isArabic ? "التاريخ" : "Date"}</th>
          <th style="text-align:center">${isArabic ? "النوع" : "Type"}</th>
          <th style="text-align:right">${isArabic ? "العنصر" : "Item"}</th>
          <th style="text-align:center">${isArabic ? "الكمية" : "Qty"}</th>
          <th style="text-align:center">${isArabic ? "قبل" : "Before"}</th>
          <th style="text-align:center">${isArabic ? "بعد" : "After"}</th>
          <th style="text-align:center">${isArabic ? "السبب" : "Reason"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${title} - Tasty Table</div>`;

  return wrapHtml(title, content, lang);
}

// ─── Print Helper ───

export function printReport(html: string): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
