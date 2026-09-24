import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import type { DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import { getReportTopItems, getReportUnavailableItems } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, RefreshCw } from "lucide-react";
import type { TopItemsReport, UnavailableItem } from "@/lib/report-types";

interface ReportsContext {
  dateRange: DateRange;
}

function generateMenuReportHtml(
  topItems: TopItemsReport,
  unavailable: UnavailableItem[],
  language: string,
  isArabic: boolean
): string {
  const topByQtyRows = topItems.byQuantity
    .slice(0, 10)
    .map(
      (item, idx) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${idx + 1}</td>
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${isArabic ? item.nameAr : item.nameEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${isArabic ? item.categoryAr : item.categoryEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;font-weight:700;color:#111">${item.quantity}×</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(item.revenue, language)}</td>
    </tr>`
    )
    .join("");

  const topByRevRows = topItems.byRevenue
    .slice(0, 10)
    .map(
      (item, idx) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${idx + 1}</td>
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${isArabic ? item.nameAr : item.nameEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${isArabic ? item.categoryAr : item.categoryEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${item.quantity}×</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:700;color:#111">${formatPrice(item.revenue, language)}</td>
    </tr>`
    )
    .join("");

  const catRows = topItems.categories
    .map(
      (cat) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${isArabic ? cat.nameAr : cat.nameEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${cat.quantity}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(cat.revenue, language)}</td>
    </tr>`
    )
    .join("");

  const unavailRows = unavailable
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${isArabic ? item.nameAr : item.nameEn}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(item.price, language)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير الأصناف</title>
<style>
  @page { margin:15mm 20mm; size:A4; }
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif; font-size:10pt; color:#000; background:#fff; direction:rtl; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { padding:6px 10px; font-size:9pt; font-weight:700; color:#374151; border-bottom:2px solid #999; text-align:right; background:#f9fafb; }
  @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>

<h1 style="font-size:16pt;font-weight:700;margin-bottom:16px">تقرير أداء الأصناف</h1>

<div style="border-bottom:2px solid #999;margin-bottom:16px"></div>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">الأكثر مبيعاً (حسب الكمية)</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:center;width:40px">#</th>
      <th style="text-align:right">الصنف</th>
      <th style="text-align:center;width:100px">التصنيف</th>
      <th style="text-align:center;width:60px">الكمية</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${topByQtyRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">الأكثر إيراداً</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:center;width:40px">#</th>
      <th style="text-align:right">الصنف</th>
      <th style="text-align:center;width:100px">التصنيف</th>
      <th style="text-align:center;width:60px">الكمية</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${topByRevRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">الإيراد حسب التصنيف</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">التصنيف</th>
      <th style="text-align:center;width:80px">الطلبات</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${catRows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

${unavailable.length > 0 ? `
<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px;color:#b45309">الأصناف غير المتاحة</h2>
<table style="border:1px solid #fbbf24;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الصنف</th>
      <th style="text-align:left">السعر</th>
    </tr>
  </thead>
  <tbody>${unavailRows}</tbody>
</table>` : ""}

<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:8pt;color:#666">
  تقرير الأصناف - Tasty Table
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export default function MenuReportPage() {
  const { dateRange } = useOutletContext<ReportsContext>();
  const { t, isArabic, language } = useLanguage();

  const [topItems, setTopItems] = useState<TopItemsReport | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableItem[]>([]);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [ti, ui] = await Promise.all([
        getReportTopItems(from, to),
        getReportUnavailableItems(),
      ]);
      if (reqId !== abortRef.current) return;
      setTopItems(ti);
      setUnavailable(ui);
    } catch {
      // ignore — leave prior state
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.from.toISOString(), dateRange.to.toISOString());
  }, [dateRange, fetchData]);

  const handlePrint = () => {
    if (!topItems) return;
    const html = generateMenuReportHtml(topItems, unavailable, language, isArabic);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t.reports.menu}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(dateRange.from.toISOString(), dateRange.to.toISOString())} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 me-1 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={loading || !topItems} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      {/* Top Items by Quantity */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.topSellingItems} - {t.reports.topByQuantity}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-center font-medium text-muted-foreground w-10">#</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الصنف" : "Item"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "التصنيف" : "Category"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الكمية" : "Qty"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الإيراد" : "Revenue"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : topItems?.byQuantity.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  topItems?.byQuantity.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-3 text-right font-medium">{isArabic ? item.nameAr : item.nameEn}</td>
                      <td className="p-3 text-center text-muted-foreground">{isArabic ? item.categoryAr : item.categoryEn}</td>
                      <td className="p-3 text-center font-bold">{item.quantity}×</td>
                      <td className="p-3 text-start font-medium">{formatPrice(item.revenue, language)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Items by Revenue */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.topSellingItems} - {t.reports.topByRevenue}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-center font-medium text-muted-foreground w-10">#</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الصنف" : "Item"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "التصنيف" : "Category"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الكمية" : "Qty"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الإيراد" : "Revenue"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : topItems?.byRevenue.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  topItems?.byRevenue.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-3 text-right font-medium">{isArabic ? item.nameAr : item.nameEn}</td>
                      <td className="p-3 text-center text-muted-foreground">{isArabic ? item.categoryAr : item.categoryEn}</td>
                      <td className="p-3 text-center">{item.quantity}×</td>
                      <td className="p-3 text-start font-bold">{formatPrice(item.revenue, language)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.categoryBreakdown}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "التصنيف" : "Category"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الطلبات" : "Orders"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الإيراد" : "Revenue"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={3} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : topItems?.categories.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  topItems?.categories.map((cat, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-right font-medium">{isArabic ? cat.nameAr : cat.nameEn}</td>
                      <td className="p-3 text-center">{cat.quantity}</td>
                      <td className="p-3 text-start font-medium">{formatPrice(cat.revenue, language)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Unavailable Items */}
      {unavailable.length > 0 && (
        <Card className="border-amber-200">
          <CardContent className="p-0">
            <div className="border-b border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-800">{t.reports.unavailableItems}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-amber-50">
                    <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الصنف" : "Item"}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "السعر" : "Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {unavailable.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-amber-50/50">
                      <td className="p-3 text-right">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">{isArabic ? item.nameAr : item.nameEn}</Badge>
                      </td>
                      <td className="p-3 text-start font-medium">{formatPrice(item.price, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
