import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import type { DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import { getReportOrdersByStatus, getReportPeakHours } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, RefreshCw } from "lucide-react";
import type { OrdersByStatus, PeakHoursReport } from "@/lib/report-types";

interface ReportsContext {
  dateRange: DateRange;
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  received: { ar: "تم الاستلام", en: "Received" },
  preparing: { ar: "جاري التحضير", en: "Preparing" },
  ready: { ar: "جاهز", en: "Ready" },
  completed: { ar: "تم التسليم", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

function generateOrdersReportHtml(
  statusData: OrdersByStatus,
  peakHours: PeakHoursReport,
  language: string
): string {
  const statusRows = statusData.statuses
    .map(
      (s) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${STATUS_LABELS[s.status]?.[language === "ar" ? "ar" : "en"] || s.status}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;font-weight:700;color:#111">${s.count}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;color:#666">${Math.round(s.percentage)}%</td>
    </tr>`
    )
    .join("");

  const peakRows = peakHours.hours
    .filter((h) => h.count > 0)
    .map(
      (h) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${h.label}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;font-weight:700;color:#111">${h.count}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;color:#666">${Math.round(h.intensity * 100)}%</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير الطلبات</title>
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

<h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">تقرير الطلبات</h1>
<p style="font-size:9pt;color:#666;margin-bottom:16px">إجمالي الطلبات: ${statusData.total}</p>

<div style="border-bottom:2px solid #999;margin-bottom:16px"></div>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">توزيع حالات الطلبات</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الحالة</th>
      <th style="text-align:center;width:80px">العدد</th>
      <th style="text-align:left;width:80px">النسبة</th>
    </tr>
  </thead>
  <tbody>${statusRows}</tbody>
  <tfoot>
    <tr style="border-top:2px solid #999;font-weight:700">
      <td style="padding:6px 10px;text-align:right;font-size:10pt">الإجمالي</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt">${statusData.total}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt">100%</td>
    </tr>
  </tfoot>
</table>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">ساعات الذروة</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الوقت</th>
      <th style="text-align:center;width:80px">الطلبات</th>
      <th style="text-align:left;width:80px">الكثافة</th>
    </tr>
  </thead>
  <tbody>${peakRows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:8pt;color:#666">
  تقرير الطلبات - Tasty Table
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export default function OrdersReportPage() {
  const { dateRange } = useOutletContext<ReportsContext>();
  const { t, language } = useLanguage();

  const [statusData, setStatusData] = useState<OrdersByStatus | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursReport | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [st, ph] = await Promise.all([
        getReportOrdersByStatus(from, to),
        getReportPeakHours(from, to),
      ]);
      if (reqId !== abortRef.current) return;
      setStatusData(st);
      setPeakHours(ph);
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
    if (!statusData || !peakHours) return;
    const html = generateOrdersReportHtml(statusData, peakHours, language);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t.reports.orders}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(dateRange.from.toISOString(), dateRange.to.toISOString())} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 me-1 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={loading || !statusData} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.orderStatusDistribution}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "العدد" : "Count"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "النسبة" : "%"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={3} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : (
                  <>
                    {statusData?.statuses.map((s, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-right font-medium">{STATUS_LABELS[s.status]?.[language === "ar" ? "ar" : "en"] || s.status}</td>
                        <td className="p-3 text-center font-bold">{s.count}</td>
                        <td className="p-3 text-start text-muted-foreground">{Math.round(s.percentage)}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold">
                      <td className="p-3 text-right">{language === "ar" ? "الإجمالي" : "Total"}</td>
                      <td className="p-3 text-center">{statusData?.total}</td>
                      <td className="p-3 text-start">100%</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.peakHours}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الوقت" : "Time"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الطلبات" : "Orders"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الكثافة" : "Intensity"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={3} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : peakHours?.hours.filter((h) => h.count > 0).length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  peakHours?.hours.filter((h) => h.count > 0).map((h) => (
                    <tr key={h.hour} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-right">{h.label}</td>
                      <td className="p-3 text-center font-bold">{h.count}</td>
                      <td className="p-3 text-start text-muted-foreground">{Math.round(h.intensity * 100)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
