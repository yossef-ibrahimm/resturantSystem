import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import type { DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getReportSummary,
  getReportRevenue,
  getReportTopItems,
  getOrders,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { orderTotal, itemsSubtotal, paymentStatusBadgeClass, paymentStatusLabel } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Printer, RefreshCw, Eye, Receipt, Clock, Hash, User, MapPin, CreditCard, ChevronLeft, ChevronRight, X, TrendingUp, ShoppingBag, Wallet, ChevronDown } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  STATUS_COLORS,
} from "@/lib/constants";
import type { Order, OrderStatus } from "@/lib/types";
import type {
  ReportSummary,
  RevenueOverTime,
  RevenueBucket,
  TopItemsReport,
} from "@/lib/report-types";

interface ReportsContext {
  dateRange: DateRange;
}

function getBucketRange(
  bucket: RevenueBucket,
  granularity: "hourly" | "daily" | "weekly",
  range: DateRange
): { from: Date; to: Date } | null {
  if (granularity === "hourly") {
    const hourMatch = bucket.label.match(/^(\d{1,2}):00$/);
    if (!hourMatch) return null;
    const hour = parseInt(hourMatch[1], 10);
    const from = new Date(range.from);
    from.setHours(hour, 0, 0, 0);
    const to = new Date(from);
    to.setHours(hour + 1, 0, 0, 0);
    return { from, to };
  }
  if (granularity === "daily") {
    const dayMatch = bucket.label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dayMatch) return null;
    const from = new Date(parseInt(dayMatch[1]), parseInt(dayMatch[2]) - 1, parseInt(dayMatch[3]), 0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }
  const weekMatch = bucket.label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!weekMatch) return null;
  const from = new Date(parseInt(weekMatch[1]), parseInt(weekMatch[2]) - 1, parseInt(weekMatch[3]), 0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

function formatBucketTitle(label: string, granularity: "hourly" | "daily" | "weekly", isArabic: boolean): string {
  if (granularity === "hourly") {
    return isArabic ? `الساعة ${label}` : `Hour ${label}`;
  }
  if (granularity === "weekly") {
    return isArabic ? `الأسبوع من ${label}` : `Week of ${label}`;
  }
  return label;
}

function formatOrderTime(iso: string, language: "ar" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: language !== "ar",
  });
}

function formatOrderDate(iso: string, language: "ar" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateSalesReportHtml(
  summary: ReportSummary,
  revenue: RevenueOverTime,
  topItems: TopItemsReport,
  language: string
): string {
  const revenueRows = revenue.data
    .map(
      (d) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${d.label}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${d.orders}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(d.revenue, language)}</td>
    </tr>`
    )
    .join("");

  const topItemsRows = topItems.byQuantity
    .slice(0, 10)
    .map(
      (item, idx) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${idx + 1}</td>
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${language === "ar" ? item.nameAr : item.nameEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${item.quantity}×</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(item.revenue, language)}</td>
    </tr>`
    )
    .join("");

  const catRows = topItems.categories
    .map(
      (cat) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${language === "ar" ? cat.nameAr : cat.nameEn}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${cat.quantity}</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt;font-weight:600;color:#111">${formatPrice(cat.revenue, language)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير المبيعات</title>
<style>
  @page { margin: 15mm 20mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif; font-size:10pt; color:#000; background:#fff; direction:rtl; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { padding:6px 10px; font-size:9pt; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #999; text-align:right; background:#f9fafb; }
  @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>

<h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">تقرير المبيعات</h1>
<p style="font-size:9pt;color:#666;margin-bottom:16px">من ${summary.range.from.split("T")[0]} إلى ${summary.range.to.split("T")[0]}</p>

<div style="border-bottom:2px solid #999;margin-bottom:16px"></div>

<!-- Summary -->
<table style="margin-bottom:20px">
  <tr>
    <td style="padding:4px 20px 4px 0;font-size:10pt;color:#555">إجمالي المبيعات</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${formatPrice(summary.revenue, language)}</td>
    <td style="padding:4px 20px 4px 20px;font-size:10pt;color:#555">إجمالي الطلبات</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${summary.orderCount}</td>
    <td style="padding:4px 20px 4px 20px;font-size:10pt;color:#555">متوسط قيمة الطلب</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${formatPrice(summary.avgValue, language)}</td>
  </tr>
</table>

<!-- Revenue Table -->
<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">الإيرادات عبر الزمن</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">التاريخ</th>
      <th style="text-align:center">الطلبات</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${revenueRows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<!-- Top Items Table -->
<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">أعلى الأصناف مبيعاً</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:center;width:40px">#</th>
      <th style="text-align:right">الصنف</th>
      <th style="text-align:center;width:60px">الكمية</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${topItemsRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<!-- Category Breakdown -->
<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">الإيراد حسب التصنيف</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">التصنيف</th>
      <th style="text-align:center">الطلبات</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${catRows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:8pt;color:#666">
  تقرير المبيعات - Tasty Table
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

interface BucketDialogState {
  bucket: RevenueBucket;
  index: number;
}

export default function SalesReportPage() {
  const { dateRange } = useOutletContext<ReportsContext>();
  const { t, isArabic, language } = useLanguage();

  const ChevronStart = isArabic ? ChevronRight : ChevronLeft;
  const ChevronEnd = isArabic ? ChevronLeft : ChevronRight;

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueOverTime | null>(null);
  const [topItems, setTopItems] = useState<TopItemsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [bucketDialog, setBucketDialog] = useState<BucketDialogState | null>(null);
  const [bucketOrders, setBucketOrders] = useState<Order[] | null>(null);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const abortRef = useRef(0);
  const bucketAbortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [s, r, ti] = await Promise.all([
        getReportSummary(from, to),
        getReportRevenue(from, to),
        getReportTopItems(from, to),
      ]);
      if (reqId !== abortRef.current) return;
      setSummary(s);
      setRevenue(r);
      setTopItems(ti);
    } catch {
      // handled
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.from.toISOString(), dateRange.to.toISOString());
  }, [dateRange, fetchData]);

  const handlePrint = () => {
    if (!summary || !revenue || !topItems) return;
    const html = generateSalesReportHtml(summary, revenue, topItems, language);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const openBucketDialog = useCallback(
    async (bucket: RevenueBucket, index: number) => {
      if (!revenue) return;
      setBucketDialog({ bucket, index });
      setBucketOrders(null);
      setExpandedOrderId(null);
      const range = getBucketRange(bucket, revenue.granularity, dateRange);
      if (!range) {
        setBucketOrders([]);
        return;
      }
      const reqId = ++bucketAbortRef.current;
      setBucketLoading(true);
      try {
        const orders = await getOrders({
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          take: 200,
        });
        if (reqId !== bucketAbortRef.current) return;
        setBucketOrders(orders);
      } catch {
        if (reqId === bucketAbortRef.current) setBucketOrders([]);
      } finally {
        if (reqId === bucketAbortRef.current) setBucketLoading(false);
      }
    },
    [revenue, dateRange]
  );

  const closeBucketDialog = useCallback(() => {
    bucketAbortRef.current++;
    setBucketDialog(null);
    setBucketOrders(null);
    setExpandedOrderId(null);
    setBucketLoading(false);
  }, []);

  const navigateBucket = useCallback(
    (direction: -1 | 1) => {
      if (!revenue || !bucketDialog) return;
      const nextIdx = bucketDialog.index + direction;
      if (nextIdx < 0 || nextIdx >= revenue.data.length) return;
      const nextBucket = revenue.data[nextIdx];
      openBucketDialog(nextBucket, nextIdx);
    },
    [revenue, bucketDialog, openBucketDialog]
  );

  const ordersTotal = bucketOrders?.reduce((s, o) => s + (o.total || 0), 0) ?? 0;
  const ordersCount = bucketOrders?.length ?? 0;
  const avgTicket = ordersCount > 0 ? ordersTotal / ordersCount : 0;
  const hasPrev = !!revenue && !!bucketDialog && bucketDialog.index > 0;
  const hasNext = !!revenue && !!bucketDialog && bucketDialog.index < revenue.data.length - 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t.reports.sales}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(dateRange.from.toISOString(), dateRange.to.toISOString())} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 me-1 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={loading || !summary} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t.reports.totalSales}</p>
            <p className="text-xl font-bold">{formatPrice(summary.revenue, language)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t.reports.totalOrders}</p>
            <p className="text-xl font-bold">{summary.orderCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t.reports.avgOrderValue}</p>
            <p className="text-xl font-bold">{formatPrice(summary.avgValue, language)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Revenue Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4 flex items-center justify-between">
            <h3 className="font-semibold">{t.reports.revenueOverTime}</h3>
            {revenue && revenue.data.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {language === "ar"
                  ? `${revenue.data.length} فترة`
                  : `${revenue.data.length} periods`}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{t.reports.date}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الطلبات" : "Orders"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الإيراد" : "Revenue"}</th>
                  <th className="p-3 text-end font-medium text-muted-foreground w-32">
                    {language === "ar" ? "إجراء" : "Action"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={4} className="p-3"><Skeleton className="h-6" /></td></tr>
                  ))
                ) : revenue?.data.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  revenue?.data.map((d, i) => {
                    const isEmpty = d.orders === 0;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-right font-medium">{d.label}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                            {d.orders}
                          </span>
                        </td>
                        <td className="p-3 text-start font-semibold tabular-nums">{formatPrice(d.revenue, language)}</td>
                        <td className="p-3 text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isEmpty}
                            onClick={() => openBucketDialog(d, i)}
                            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{t.reports.viewDetails}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.topSellingItems}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-center font-medium text-muted-foreground w-10">#</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الصنف" : "Item"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الكمية" : "Qty"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{language === "ar" ? "الإيراد" : "Revenue"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : topItems?.byQuantity.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  topItems?.byQuantity.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-3 text-right">
                        <span className="font-medium">{isArabic ? item.nameAr : item.nameEn}</span>
                        <span className="block text-xs text-muted-foreground">{isArabic ? item.categoryAr : item.categoryEn}</span>
                      </td>
                      <td className="p-3 text-center">{item.quantity}×</td>
                      <td className="p-3 text-start font-medium">{formatPrice(item.revenue, language)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
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

      {/* Bucket Details Dialog */}
      <Dialog open={!!bucketDialog} onOpenChange={(open) => !open && closeBucketDialog()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
          {bucketDialog && revenue && (
            <>
              {/* Header band */}
              <div className="relative bg-gradient-to-br from-primary/8 via-background to-background border-b">
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {t.reports.bucketOrders}
                        </p>
                        <DialogTitle className="text-xl font-semibold mt-0.5 truncate">
                          {formatBucketTitle(bucketDialog.bucket.label, revenue.granularity, isArabic)}
                        </DialogTitle>
                      </div>
                    </div>
                    <DialogClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" aria-label={t.reports.bucketClose}>
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogClose>
                  </div>

                  {/* Period nav */}
                  <div className="flex items-center justify-between mt-5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={!hasPrev}
                      onClick={() => navigateBucket(-1)}
                    >
                      <ChevronStart className="h-3.5 w-3.5" />
                      {language === "ar" ? "الفترة السابقة" : "Previous"}
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {bucketDialog.index + 1} / {revenue.data.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={!hasNext}
                      onClick={() => navigateBucket(1)}
                    >
                      {language === "ar" ? "الفترة التالية" : "Next"}
                      <ChevronEnd className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-md bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {t.reports.bucketTotalRevenue}
                      </div>
                      <div className="text-base font-bold tabular-nums mt-1 truncate">
                        {bucketLoading && !bucketOrders
                          ? <Skeleton className="h-5 w-20" />
                          : formatPrice(ordersTotal, language)}
                      </div>
                    </div>
                    <div className="rounded-md bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <ShoppingBag className="h-3 w-3" />
                        {t.reports.bucketTotalOrders}
                      </div>
                      <div className="text-base font-bold tabular-nums mt-1">
                        {bucketLoading && !bucketOrders
                          ? <Skeleton className="h-5 w-10" />
                          : ordersCount}
                      </div>
                    </div>
                    <div className="rounded-md bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <Wallet className="h-3 w-3" />
                        {t.reports.bucketAvgTicket}
                      </div>
                      <div className="text-base font-bold tabular-nums mt-1 truncate">
                        {bucketLoading && !bucketOrders
                          ? <Skeleton className="h-5 w-20" />
                          : formatPrice(avgTicket, language)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orders list */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                <DialogDescription className="sr-only">
                  {t.reports.bucketOrders}
                </DialogDescription>
                {bucketLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-md" />
                    ))}
                  </div>
                ) : !bucketOrders || bucketOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.reports.bucketNoOrders}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bucketOrders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        expanded={expandedOrderId === order.id}
                        onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        language={language}
                        isArabic={isArabic}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? `${ordersCount} ${isArabic ? "" : ""} ${language === "ar" ? "طلب" : ordersCount === 1 ? "order" : "orders"}`
                    : `${ordersCount} ${ordersCount === 1 ? "order" : "orders"}`}
                </span>
                <Button variant="outline" size="sm" onClick={closeBucketDialog}>
                  {t.reports.bucketClose}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  language: "ar" | "en";
  isArabic: boolean;
}

function OrderRow({ order, expanded, onToggle, language, isArabic }: OrderRowProps) {
  const status = order.status as OrderStatus;
  const statusLabel = ORDER_STATUS_LABELS[status]?.[language as "ar" | "en"] || status;
  const statusColor = STATUS_COLORS[status] || "";
  const typeLabel = ORDER_TYPE_LABELS[order.orderType]?.[language as "ar" | "en"] || order.orderType;
  const itemsTotal = itemsSubtotal(order);
  const listTotal = orderTotal(order);

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left rtl:text-right px-4 py-3 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {order.orderNumber}
            </span>
            <Badge className={`${statusColor} text-[10px] px-2 py-0`}>{statusLabel}</Badge>
            <Badge variant="outline" className="text-[10px] px-2 py-0">{typeLabel}</Badge>
            {order.tableNumber !== undefined && order.tableNumber !== null && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {isArabic ? `طاولة ${order.tableNumber}` : `Table ${order.tableNumber}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {order.customerName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatOrderDate(order.createdAt, language)} · {formatOrderTime(order.createdAt, language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              {order.items.length} {isArabic ? "صنف" : "items"}
            </span>
          </div>
        </div>
        <div className="text-end shrink-0">
          <div className="text-sm font-bold tabular-nums">{formatPrice(listTotal, language)}</div>
          {order.discountAmount > 0 && (
            <div className="text-[10px] text-muted-foreground line-through tabular-nums">
              {formatPrice(itemsTotal, language)}
            </div>
          )}
        </div>
        <ChevronDown
          className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
          {order.notes && (
            <p className="text-xs text-muted-foreground italic">"{order.notes}"</p>
          )}
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs gap-3">
                <span className="text-foreground">
                  {isArabic ? item.nameAr : item.nameEn}
                  {item.variant && <span className="text-muted-foreground"> · {item.variant}</span>}
                  <span className="text-muted-foreground"> × {item.quantity}</span>
                </span>
                <span className="font-semibold tabular-nums shrink-0">{formatPrice(item.unitPrice * item.quantity, language)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>{isArabic ? "الإجمالي قبل الخصم" : "Subtotal"}</span>
              <span className="tabular-nums">{formatPrice(order.itemsTotal, language)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{isArabic ? "الخصم" : "Discount"}</span>
                <span className="tabular-nums">− {formatPrice(order.discountAmount, language)}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{isArabic ? `الضريبة (${order.taxRate}%)` : `Tax (${order.taxRate}%)`}</span>
                <span className="tabular-nums">{formatPrice(order.taxAmount, language)}</span>
              </div>
            )}
            {order.serviceAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{isArabic ? `الخدمة (${order.serviceRate}%)` : `Service (${order.serviceRate}%)`}</span>
                <span className="tabular-nums">{formatPrice(order.serviceAmount, language)}</span>
              </div>
            )}
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-bold">
            <span>{isArabic ? "الإجمالي" : "Total"}</span>
            <span className="tabular-nums">{formatPrice(order.total, language)}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isArabic ? "حالة الدفع" : "Payment"}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${paymentStatusBadgeClass(order.paymentStatus)}`}
            >
              {paymentStatusLabel(order.paymentStatus, isArabic)}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
