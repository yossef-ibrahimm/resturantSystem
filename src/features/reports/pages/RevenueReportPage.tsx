import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import type { DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import { getReportSummary, getReportRevenue, getOrders } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { ChevronDown, ChevronUp, Eye, FileText, Printer, RefreshCw } from "lucide-react";
import type { ReportSummary, RevenueOverTime } from "@/lib/report-types";
import type { Order } from "@/lib/types";

interface ReportsContext {
  dateRange: DateRange;
}

function getOrderDayKey(createdAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(createdAt));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatOrderDay(dayKey: string, language: string) {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Cairo",
  });
}

function generateRevenueReportHtml(
  summary: ReportSummary,
  revenue: RevenueOverTime,
  language: string,
  orders: Order[]
): string {
  const groupedOrders = new Map<string, Order[]>();
  orders.forEach((order) => {
    const day = getOrderDayKey(order.createdAt);
    groupedOrders.set(day, [...(groupedOrders.get(day) || []), order]);
  });
  const rows = Array.from(groupedOrders.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([day, dayOrders]) => {
    const dayRevenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
    return `
    <tr class="day-row">
      <td colspan="3"><strong>${formatOrderDay(day, language)}</strong><span>${dayOrders.length} ${language === "ar" ? "طلب" : "orders"}</span><b>${formatPrice(dayRevenue, language)}</b></td>
    </tr>
    ${dayOrders.map((order) => `
    <tr class="order-row">
      <td>#${order.orderNumber}<br><small>${formatDate(order.createdAt, language)}</small></td>
      <td>${order.customerName}${order.phone ? `<br><small>${order.phone}</small>` : ""}<br><small>${ORDER_TYPE_LABELS[order.orderType]?.[language as "ar" | "en"] ?? order.orderType}</small></td>
      <td style="text-align:left;font-weight:600">${formatPrice(order.total, language)}</td>
    </tr>`).join("")}`;
  }).join("");

  const totalRevenue = revenue.data.reduce((sum, d) => sum + d.revenue, 0);
  void totalRevenue;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير الإيرادات</title>
<style>
  @page { margin:15mm 20mm; size:A4; }
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif; font-size:10pt; color:#000; background:#fff; direction:rtl; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { padding:7px 10px; font-size:9pt; font-weight:700; color:#374151; border-bottom:2px solid #999; text-align:right; background:#f9fafb; }
  td { padding:7px 10px; font-size:9pt; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  small { color:#6b7280; font-size:8pt; }
  .day-row { page-break-after:avoid; background:#f3f4f6; border-top:1px solid #9ca3af; }
  .day-row td { padding:8px 10px; }
  .day-row span { margin-right:24px; color:#4b5563; font-weight:400; }
  .day-row b { float:left; }
  .order-row { page-break-inside:avoid; }
  .order-row td:first-child { width:34%; }
  .order-row td:nth-child(2) { width:38%; }
  .order-row td:last-child { width:28%; }
  @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>

<h1 style="font-size:16pt;font-weight:700;margin-bottom:4px">تقرير الإيرادات</h1>
<p style="font-size:9pt;color:#666;margin-bottom:16px">من ${summary.range.from.split("T")[0]} إلى ${summary.range.to.split("T")[0]}</p>

<div style="border-bottom:2px solid #999;margin-bottom:16px"></div>

<!-- Summary -->
<table style="margin-bottom:20px">
  <tr>
    <td style="padding:4px 20px 4px 0;font-size:10pt;color:#555">إجمالي المبيعات</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${formatPrice(summary.revenue, language)}</td>
    <td style="padding:4px 20px 4px 20px;font-size:10pt;color:#555">عدد الطلبات</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${summary.orderCount}</td>
    <td style="padding:4px 20px 4px 20px;font-size:10pt;color:#555">متوسط الطلب</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${formatPrice(summary.avgValue, language)}</td>
  </tr>
  <tr>
    <td style="padding:4px 20px 4px 0;font-size:10pt;color:#555">صالة</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${summary.dineIn}</td>
    <td style="padding:4px 20px 4px 20px;font-size:10pt;color:#555">تيك أواي</td>
    <td style="padding:4px 0;font-size:11pt;font-weight:700">${summary.takeaway}</td>
  </tr>
</table>

<!-- Daily order details -->
<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">تفصيل الإيرادات والطلبات</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الطلب والتوقيت</th>
      <th style="text-align:right">العميل والنوع</th>
      <th style="text-align:left">الإيراد</th>
    </tr>
  </thead>
  <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#666">لا توجد طلبات مدفوعة في هذه الفترة</td></tr>`}</tbody>
  <tfoot>
    <tr style="border-top:2px solid #999;font-weight:700">
      <td colspan="2" style="padding:6px 10px;text-align:right;font-size:10pt">الإجمالي</td>
      <td style="padding:6px 10px;text-align:left;font-size:10pt">${formatPrice(totalRevenue, language)}</td>
    </tr>
  </tfoot>
</table>

<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:8pt;color:#666">
  تقرير الإيرادات - Tasty Table
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export default function RevenueReportPage() {
  const { dateRange } = useOutletContext<ReportsContext>();
  const { t, language } = useLanguage();

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueOverTime | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [s, r, o] = await Promise.all([
        getReportSummary(from, to),
        getReportRevenue(from, to),
        getOrders({ from, to, take: 500 }),
      ]);
      if (reqId !== abortRef.current) return;
      setSummary(s);
      setRevenue(r);
      setOrders(o.filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled"));
    } catch {
      setOrders([]);
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.from.toISOString(), dateRange.to.toISOString());
  }, [dateRange, fetchData]);

  const handlePrint = () => {
    if (!summary || !revenue) return;
    const html = generateRevenueReportHtml(summary, revenue, language, orders);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const orderDetailsLabel = language === "ar" ? "تفاصيل الطلبات" : "Order details";
  const noOrdersLabel = language === "ar" ? "لا توجد طلبات مدفوعة في هذه الفترة" : "No paid orders in this period";
  const orderGroups = Array.from(orders.reduce((groups, order) => {
    const day = getOrderDayKey(order.createdAt);
    const group = groups.get(day) || [];
    group.push(order);
    groups.set(day, group);
    return groups;
  }, new Map<string, Order[]>()).entries()).sort(([a], [b]) => b.localeCompare(a));

  const toggleDay = (day: string) => {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t.reports.revenue}</h2>
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

      {/* Summary */}
      {loading && !summary ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t.reports.totalSales}</p>
            <p className="text-xl font-bold">{formatPrice(summary.revenue, language)}</p>
            {summary.revenueChange !== null && (
              <p className={`text-xs ${summary.revenueChange > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {summary.revenueChange > 0 ? "+" : ""}{Math.round(summary.revenueChange)}% {t.reports.compareWithPrevious}
              </p>
            )}
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

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">{t.reports.dailyBreakdown} · {orderDetailsLabel}</h3>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "افتح أي يوم لمراجعة كل الطلبات المحتسبة في الإيرادات" : "Expand a day to review every order included in revenue"}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="font-semibold">
              {orders.length} {language === "ar" ? "طلب" : "orders"}
            </Badge>
          </div>
          <div className="divide-y">
            {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="p-4"><Skeleton className="h-12" /></div>) : orderGroups.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">{noOrdersLabel}</div>
            ) : orderGroups.map(([day, dayOrders]) => {
              const isExpanded = expandedDays.has(day);
              const dayRevenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
              return (
                <div key={day}>
                  <button type="button" onClick={() => toggleDay(day)} className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-muted/30 sm:p-5">
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{formatOrderDay(day, language)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dayOrders.length} {language === "ar" ? "طلب" : "orders"}</p>
                    </div>
                    <span className="shrink-0 font-bold">{formatPrice(dayRevenue, language)}</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t bg-muted/10">
                      {dayOrders.map((order) => (
                        <div key={order.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0 sm:px-12">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">#{order.orderNumber}</span>
                              <Badge variant="outline" className="text-[11px]">{ORDER_TYPE_LABELS[order.orderType][language]}</Badge>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{order.customerName}{order.phone && ` · ${order.phone}`} · {formatDate(order.createdAt, language)}</p>
                          </div>
                          <span className="shrink-0 text-sm font-bold">{formatPrice(order.total, language)}</span>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)} aria-label={`${orderDetailsLabel} #${order.orderNumber}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && orderGroups.length > 0 && (
              <div className="flex items-center justify-between bg-muted/40 p-4 text-sm font-bold sm:p-5">
                <span>{language === "ar" ? "إجمالي الفترة" : "Period total"} · {orders.length} {language === "ar" ? "طلب" : "orders"}</span>
                <span>{formatPrice(orders.reduce((sum, order) => sum + order.total, 0), language)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pe-6">
                  <div>
                    <DialogTitle>#{selectedOrder.orderNumber}</DialogTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedOrder.createdAt, language)}</p>
                  </div>
                  <Badge className={STATUS_COLORS[selectedOrder.status]}>{ORDER_STATUS_LABELS[selectedOrder.status][language]}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">{language === "ar" ? "العميل" : "Customer"}</p><p className="mt-1 font-medium">{selectedOrder.customerName}</p></div>
                  <div><p className="text-xs text-muted-foreground">{language === "ar" ? "نوع الطلب" : "Order type"}</p><p className="mt-1 font-medium">{ORDER_TYPE_LABELS[selectedOrder.orderType][language]}</p></div>
                  {selectedOrder.phone && <div><p className="text-xs text-muted-foreground">{language === "ar" ? "الهاتف" : "Phone"}</p><p className="mt-1 font-medium">{selectedOrder.phone}</p></div>}
                  {selectedOrder.tableNumber && <div><p className="text-xs text-muted-foreground">{language === "ar" ? "الطاولة" : "Table"}</p><p className="mt-1 font-medium">{selectedOrder.tableNumber}</p></div>}
                </div>
                {selectedOrder.notes && <p className="rounded-lg border p-3 text-sm text-muted-foreground">{selectedOrder.notes}</p>}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">{language === "ar" ? "الأصناف" : "Items"}</h4>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                      <div><p className="font-medium">{language === "ar" ? item.nameAr : item.nameEn} × {item.quantity}</p>{item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}</div>
                      <span className="shrink-0 font-semibold">{formatPrice(item.unitPrice * item.quantity, language)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{language === "ar" ? "إجمالي الأصناف" : "Items total"}</span><span>{formatPrice(selectedOrder.itemsTotal, language)}</span></div>
                  {selectedOrder.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>{language === "ar" ? "الخصم" : "Discount"}</span><span>- {formatPrice(selectedOrder.discountAmount, language)}</span></div>}
                  {selectedOrder.taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{language === "ar" ? `الضريبة (${selectedOrder.taxRate}%)` : `Tax (${selectedOrder.taxRate}%)`}</span><span>{formatPrice(selectedOrder.taxAmount, language)}</span></div>}
                  {selectedOrder.serviceAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{language === "ar" ? `الخدمة (${selectedOrder.serviceRate}%)` : `Service (${selectedOrder.serviceRate}%)`}</span><span>{formatPrice(selectedOrder.serviceAmount, language)}</span></div>}
                  <div className="flex justify-between border-t pt-3 text-base font-bold"><span>{t.orderStatus.total}</span><span>{formatPrice(selectedOrder.total, language)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{language === "ar" ? "المدفوع" : "Paid"}</span><span>{formatPrice(selectedOrder.paidTotal, language)}</span></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
