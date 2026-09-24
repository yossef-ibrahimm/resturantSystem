import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { DateRangePicker, type DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveMainExpenseCategories, getExpenseSummary, getExpenses } from "@/lib/api";
import type { Expense, ExpenseSummary } from "@/lib/expense-types";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Printer,
  RefreshCw,
  Receipt,
  Wallet,
  Layers3,
  Search,
  SlidersHorizontal,
  RotateCcw,
  CreditCard,
  TrendingUp,
  CalendarDays,
  Inbox,
} from "lucide-react";

interface ReportsContext {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const PAYMENT_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  card: { ar: "بطاقة", en: "Card" },
  wallet: { ar: "محفظة", en: "Wallet" },
  other: { ar: "أخرى", en: "Other" },
};

// Distinct accent per payment method so the legend dot and the bar always match,
// instead of every row sharing one flat accent color.
const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-500",
  card: "bg-blue-500",
  wallet: "bg-violet-500",
  other: "bg-slate-400",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#039;");
}

function dateLabel(value: string, language: "ar" | "en") {
  return new Date(value).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateExpensesReportHtml(
  summary: ExpenseSummary,
  expenses: Expense[],
  from: string,
  to: string,
  language: "ar" | "en"
): string {
  const isArabic = language === "ar";
  const paymentLabel = (method: string) => PAYMENT_LABELS[method]?.[language] || method;
  const categoryRows = summary.byMainCategory
    .sort((a, b) => b.total - a.total)
    .map(
      (category) =>
        `<tr><td>${escapeHtml(isArabic ? category.nameAr : category.nameEn)}</td><td class="center">${category.count}</td><td class="amount">${escapeHtml(formatPrice(category.total, language))}</td></tr>`
    )
    .join("");
  const paymentRows = summary.byPaymentMethod
    .sort((a, b) => b.total - a.total)
    .map(
      (payment) =>
        `<tr><td>${escapeHtml(paymentLabel(payment.method))}</td><td class="amount">${escapeHtml(formatPrice(payment.total, language))}</td></tr>`
    )
    .join("");
  const expenseRows = expenses
    .map(
      (expense) =>
        `<tr><td>${escapeHtml(dateLabel(expense.spentAt, language))}</td><td>${escapeHtml(isArabic ? expense.mainCategoryNameAr : expense.mainCategoryNameEn)}</td><td>${escapeHtml(isArabic ? expense.subCategoryNameAr : expense.subCategoryNameEn)}</td><td>${escapeHtml(expense.description)}</td><td>${escapeHtml(paymentLabel(expense.paymentMethod))}</td><td class="amount">${escapeHtml(formatPrice(expense.amount, language))}</td></tr>`
    )
    .join("");
  const title = isArabic ? "تقرير المصروفات" : "Expenses Report";
  const totalLabel = isArabic ? "إجمالي المصروفات" : "Total Expenses";
  const countLabel = isArabic ? "عدد العمليات" : "Transactions";
  const averageLabel = isArabic ? "متوسط العملية" : "Average Transaction";
  const generatedLabel = isArabic ? "تم الإنشاء في" : "Generated on";
  const generatedAt = new Date().toLocaleString(isArabic ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!DOCTYPE html><html dir="${isArabic ? "rtl" : "ltr"}" lang="${language}"><head><meta charset="UTF-8"><title>${title}</title><style>
    @page{margin:15mm 16mm;size:A4}*{box-sizing:border-box}body{font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif;font-size:9pt;color:#1f2937;background:#fff;line-height:1.55}
    .letterhead{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:4px}
    h1{font-size:18pt;margin:0;letter-spacing:-.01em}h2{font-size:11pt;margin:24px 0 8px;color:#111827}
    p{margin:0;color:#6b7280}.meta{margin-top:2px;font-size:9pt}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 22px}
    .metric{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}
    .metric-label{font-size:7.5pt;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
    .metric-value{font-size:14pt;font-weight:700;margin-top:3px;color:#111827}
    table{border-collapse:collapse;width:100%;margin-bottom:14px}
    th{background:#f9fafb;border-bottom:1.5px solid #d1d5db;font-weight:600;text-align:${isArabic ? "right" : "left"};padding:7px 8px;font-size:8.5pt;color:#374151}
    td{border-bottom:1px solid #f0f1f3;padding:6px 8px;vertical-align:top}
    .center{text-align:center}.amount{text-align:${isArabic ? "left" : "right"};font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
    .total td{border-top:1.5px solid #9ca3af;border-bottom:0;font-weight:700;background:#f9fafb}
    .footer{border-top:1px solid #e5e7eb;padding-top:8px;margin-top:26px;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{break-after:avoid}tr{break-inside:avoid}}
  </style></head><body>
  <div class="letterhead"><h1>${title}</h1><p class="meta">${isArabic ? "الفترة" : "Period"}: ${escapeHtml(from)} – ${escapeHtml(to)}</p></div>
  <div class="summary"><div class="metric"><div class="metric-label">${totalLabel}</div><div class="metric-value">${escapeHtml(formatPrice(summary.grandTotal, language))}</div></div><div class="metric"><div class="metric-label">${countLabel}</div><div class="metric-value">${summary.totalCount}</div></div><div class="metric"><div class="metric-label">${averageLabel}</div><div class="metric-value">${escapeHtml(formatPrice(summary.totalCount ? summary.grandTotal / summary.totalCount : 0, language))}</div></div></div>
  <h2>${isArabic ? "المصروفات حسب الفئة الرئيسية" : "Expenses by Main Category"}</h2><table><thead><tr><th>${isArabic ? "الفئة" : "Category"}</th><th class="center">${isArabic ? "العدد" : "Count"}</th><th class="amount">${isArabic ? "الإجمالي" : "Total"}</th></tr></thead><tbody>${categoryRows || `<tr><td colspan="3">${isArabic ? "لا توجد بيانات" : "No data"}</td></tr>`}</tbody><tfoot><tr class="total"><td>${totalLabel}</td><td class="center">${summary.totalCount}</td><td class="amount">${escapeHtml(formatPrice(summary.grandTotal, language))}</td></tr></tfoot></table>
  <h2>${isArabic ? "المصروفات حسب طريقة الدفع" : "Expenses by Payment Method"}</h2><table><thead><tr><th>${isArabic ? "طريقة الدفع" : "Payment Method"}</th><th class="amount">${isArabic ? "الإجمالي" : "Total"}</th></tr></thead><tbody>${paymentRows || `<tr><td colspan="2">${isArabic ? "لا توجد بيانات" : "No data"}</td></tr>`}</tbody></table>
  <h2>${isArabic ? "التفصيل" : "Expense Details"}</h2><table><thead><tr><th>${isArabic ? "التاريخ" : "Date"}</th><th>${isArabic ? "الفئة الرئيسية" : "Main Category"}</th><th>${isArabic ? "الفئة الفرعية" : "Sub-category"}</th><th>${isArabic ? "البيان" : "Description"}</th><th>${isArabic ? "الدفع" : "Payment"}</th><th class="amount">${isArabic ? "المبلغ" : "Amount"}</th></tr></thead><tbody>${expenseRows || `<tr><td colspan="6">${isArabic ? "لا توجد بيانات" : "No data"}</td></tr>`}</tbody><tfoot><tr class="total"><td colspan="5">${totalLabel}</td><td class="amount">${escapeHtml(formatPrice(summary.grandTotal, language))}</td></tr></tfoot></table>
  <div class="footer"><span>Tasty Table</span><span>${generatedLabel}: ${escapeHtml(generatedAt)}</span></div>
  <script>window.onload=function(){window.print();}</script></body></html>`;
}

export default function ExpensesReportPage() {
  const { dateRange, setDateRange } = useOutletContext<ReportsContext>();
  const { t, language, isArabic } = useLanguage();
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");
  const abortRef = useRef(0);

  const { data: mainCategories = [] } = useQuery({
    queryKey: ["expense-report-main-categories"],
    queryFn: getActiveMainExpenseCategories,
  });

  const fetchData = useCallback(
    async (from: string, to: string) => {
      const requestId = ++abortRef.current;
      setLoading(true);
      try {
        const [nextSummary, nextExpenses] = await Promise.all([
          getExpenseSummary({ from, to, mainCategoryId: mainCategoryId || undefined, paymentMethod: paymentMethod || undefined, search: search || undefined }),
          getExpenses({ from, to, mainCategoryId: mainCategoryId || undefined, paymentMethod: paymentMethod || undefined, search: search || undefined, take: 500 }),
        ]);
        if (requestId !== abortRef.current) return;
        setSummary(nextSummary);
        setExpenses(nextExpenses.items);
      } finally {
        if (requestId === abortRef.current) setLoading(false);
      }
    },
    [mainCategoryId, paymentMethod, search]
  );

  useEffect(() => {
    fetchData(dateRange.from.toISOString(), dateRange.to.toISOString());
  }, [dateRange, fetchData]);

  const fromLabel = dateLabel(dateRange.from.toISOString(), language);
  const toLabel = dateLabel(dateRange.to.toISOString(), language);
  const average = summary && summary.totalCount > 0 ? summary.grandTotal / summary.totalCount : 0;
  const paymentLabel = (method: string) => PAYMENT_LABELS[method]?.[language] || method;
  const activeFilterCount = [search, mainCategoryId, paymentMethod].filter(Boolean).length;
  const sortedCategories = [...(summary?.byMainCategory || [])].sort((a, b) => b.total - a.total);
  const sortedPayments = [...(summary?.byPaymentMethod || [])].sort((a, b) => b.total - a.total);
  const maxCategoryTotal = Math.max(...sortedCategories.map((category) => category.total), 1);
  const maxPaymentTotal = Math.max(...sortedPayments.map((payment) => payment.total), 1);

  const handlePrint = () => {
    if (!summary) return;
    const html = generateExpensesReportHtml(summary, expenses, fromLabel, toLabel, language);
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const clearFilters = () => {
    setSearch("");
    setMainCategoryId("");
    setPaymentMethod("");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{t.reports.expenses}</h2>
            <p className="text-sm text-muted-foreground">
              {fromLabel} – {toLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(dateRange.from.toISOString(), dateRange.to.toISOString())}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 me-1.5 ${loading ? "animate-spin" : ""}`} />
            {isArabic ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={loading || !summary} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      {/* KPI row — one consistent card treatment, color reserved for the icon chip only */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
      ) : (
        summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isArabic ? "إجمالي المصروفات" : "Total Expenses"}
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight">
                    {formatPrice(summary.grandTotal, language)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isArabic ? "عدد العمليات" : "Transactions"}
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight">
                    {summary.totalCount.toLocaleString(language === "ar" ? "ar-EG" : "en-US")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isArabic ? "متوسط العملية" : "Average Transaction"}
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight">{formatPrice(average, language)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{isArabic ? "تصفية التقرير" : "Filter report"}</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {activeFilterCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="h-8 gap-1.5 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isArabic ? "إعادة ضبط" : "Reset"}
          </Button>
        </div>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{isArabic ? "بحث" : "Search"}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isArabic ? "البيان أو الفئة..." : "Description or category..."}
                aria-label={isArabic ? "بحث في المصروفات" : "Search expenses"}
                className="ps-9"
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{isArabic ? "الفئة الرئيسية" : "Main category"}</span>
            <select
              value={mainCategoryId}
              onChange={(event) => setMainCategoryId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label={isArabic ? "الفئة الرئيسية" : "Main category"}
            >
              <option value="">{isArabic ? "كل الفئات الرئيسية" : "All main categories"}</option>
              {mainCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {isArabic ? category.nameAr : category.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{isArabic ? "طريقة الدفع" : "Payment method"}</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label={isArabic ? "طريقة الدفع" : "Payment method"}
            >
              <option value="">{isArabic ? "كل طرق الدفع" : "All payment methods"}</option>
              <option value="cash">{isArabic ? "نقدي" : "Cash"}</option>
              <option value="card">{isArabic ? "بطاقة" : "Card"}</option>
              <option value="wallet">{isArabic ? "محفظة" : "Wallet"}</option>
              <option value="other">{isArabic ? "أخرى" : "Other"}</option>
            </select>
          </label>
          <label className="space-y-1.5 "style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span className="text-xs font-medium text-muted-foreground">{isArabic ? "الفترة" : "Period"}</span>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </label>
        </CardContent>
      </Card>

      {/* Breakdown panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">{isArabic ? "المصروفات حسب الفئة" : "Expenses by category"}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isArabic ? "أعلى الفئات تكلفة في الفترة" : "Highest-cost categories in this period"}
                </p>
              </div>
            </div>
            <div className="space-y-4 p-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)
              ) : sortedCategories.length ? (
                sortedCategories.map((category, index) => (
                  <div key={category.mainCategoryId} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">{isArabic ? category.nameAr : category.nameEn}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatPrice(category.total, language)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(category.total / maxCategoryTotal) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-end text-xs text-muted-foreground">
                          {category.count} {isArabic ? "عملية" : "items"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label={t.reports.noData} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">{isArabic ? "التوزيع حسب الدفع" : "Payment distribution"}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isArabic ? "قيمة المصروفات لكل طريقة دفع" : "Expense value by payment method"}
                </p>
              </div>
            </div>
            <div className="space-y-4 p-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)
              ) : sortedPayments.length ? (
                sortedPayments.map((payment) => (
                  <div key={payment.method} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PAYMENT_COLORS[payment.method] || "bg-muted-foreground"}`} />
                        {paymentLabel(payment.method)}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatPrice(payment.total, language)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${PAYMENT_COLORS[payment.method] || "bg-muted-foreground"}`}
                        style={{ width: `${(payment.total / maxPaymentTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label={t.reports.noData} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">{isArabic ? "سجل المصروفات" : "Expense ledger"}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {expenses.length} {isArabic ? "عملية معروضة" : "transactions shown"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold tabular-nums">
              {summary ? formatPrice(summary.grandTotal, language) : "–"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-start font-medium text-muted-foreground">{isArabic ? "التاريخ" : "Date"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{isArabic ? "الفئة" : "Category"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{isArabic ? "الوصف" : "Description"}</th>
                  <th className="p-3 text-start font-medium text-muted-foreground">{isArabic ? "طريقة الدفع" : "Method"}</th>
                  <th className="p-3 text-end font-medium text-muted-foreground">{isArabic ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={5} className="p-3">
                        <Skeleton className="h-7" />
                      </td>
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12">
                      <EmptyState label={t.reports.noData} />
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap p-3 align-top text-muted-foreground">
                        {dateLabel(expense.spentAt, language)}
                      </td>
                      <td className="p-3 align-top">
                        <div className="font-medium">
                          {isArabic ? expense.mainCategoryNameAr : expense.mainCategoryNameEn}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {isArabic ? expense.subCategoryNameAr : expense.subCategoryNameEn}
                        </div>
                      </td>
                      <td className="max-w-[280px] p-3 align-top">
                        <div className="truncate font-medium" title={expense.description}>
                          {expense.description}
                        </div>
                        {expense.note && (
                          <div className="mt-1 truncate text-xs text-muted-foreground" title={expense.note}>
                            {expense.note}
                          </div>
                        )}
                        {expense.recordedBy?.name && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {isArabic ? "بواسطة" : "By"}: {expense.recordedBy.name}
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {paymentLabel(expense.paymentMethod)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap p-3 text-end align-top font-semibold tabular-nums">
                        {formatPrice(expense.amount, language)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && expenses.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold">
                    <td colSpan={4} className="p-3 text-end">
                      {isArabic ? "الإجمالي" : "Total"}
                    </td>
                    <td className="whitespace-nowrap p-3 text-end tabular-nums">
                      {summary ? formatPrice(summary.grandTotal, language) : "–"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}