import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/i18n";
import {
  getReportSummary,
  getReportRevenue,
  getReportOrdersByStatus,
  getReportTopItems,
  getReportPeakHours,
  getReportUnavailableItems,
  getOrders,
} from "@/lib/api";
import { formatPrice, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_LABELS, STATUS_COLORS, STATUS_BAR_COLORS } from "@/lib/constants";
import { DateRangePicker, useDateRange } from "@/components/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, UtensilsCrossed,
  RefreshCw, AlertTriangle, Clock, BarChart3, Flame,
  Minus,
} from "lucide-react";
import type { ReportSummary, RevenueOverTime, OrdersByStatus, TopItemsReport, PeakHoursReport, UnavailableItem, TopItem } from "@/lib/report-types";
import type { Order } from "@/lib/types";

const STATUS_COLORS_HEX: Record<string, string> = {
  received: "#3b82f6",
  preparing: "#f59e0b",
  ready: "#10b981",
  completed: "#6b7280",
};

function ChangeIndicator({ value, language }: { value: number | null; language: string }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        {language === "ar" ? "جديد" : "New"}
      </span>
    );
  }
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isZero ? "text-muted-foreground" : isPositive ? "text-emerald-600" : "text-red-500"}`}>
      {isZero ? <Minus className="h-3 w-3" /> : isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{Math.round(value)}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { t, isArabic, language } = useLanguage();
  const [dateRange, setDateRange] = useDateRange();

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueOverTime | null>(null);
  const [statusData, setStatusData] = useState<OrdersByStatus | null>(null);
  const [topItems, setTopItems] = useState<TopItemsReport | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursReport | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [s, r, st, ti, ph, ui, ro] = await Promise.all([
        getReportSummary(from, to),
        getReportRevenue(from, to),
        getReportOrdersByStatus(from, to),
        getReportTopItems(from, to),
        getReportPeakHours(from, to),
        getReportUnavailableItems(),
        getOrders({ take: 10 }),
      ]);
      if (reqId !== abortRef.current) return;
      setSummary(s);
      setRevenue(r);
      setStatusData(st);
      setTopItems(ti);
      setPeakHours(ph);
      setUnavailable(ui);
      setRecentOrders(ro.slice(0, 10));
      setLastUpdated(new Date());
    } catch {
      // handled by individual api functions fallback
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();
    fetchData(from, to);
  }, [dateRange, fetchData]);

  const handleRefresh = () => {
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();
    fetchData(from, to);
  };

  // ─── Summary ───
  const summaryCards = summary
    ? [
        { label: t.admin.stats.totalRevenue, value: formatPrice(summary.revenue, language), change: summary.revenueChange, icon: DollarSign, gradient: "from-emerald-500/10 to-emerald-600/5", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
        { label: t.admin.stats.totalOrders, value: summary.orderCount, change: summary.orderCountChange, icon: ShoppingCart, gradient: "from-blue-500/10 to-blue-600/5", iconBg: "bg-blue-500/10", iconColor: "text-blue-600" },
        { label: t.admin.stats.avgOrderValue, value: formatPrice(summary.avgValue, language), change: summary.avgValueChange, icon: TrendingUp, gradient: "from-violet-500/10 to-violet-600/5", iconBg: "bg-violet-500/10", iconColor: "text-violet-600" },
        { label: t.admin.stats.ordersByType, value: `${summary.dineIn} / ${summary.takeaway}`, change: null, icon: UtensilsCrossed, gradient: "from-amber-500/10 to-amber-600/5", iconBg: "bg-amber-500/10", iconColor: "text-amber-600", sub: `${t.admin.stats.dineIn} / ${t.admin.stats.takeaway}` },
      ]
    : [];

  // ─── Revenue Chart Data ───
  const revenueData = revenue?.data || [];
  const revenueChartConfig = {
    revenue: { label: language === "ar" ? "الإيراد" : "Revenue", color: "hsl(153, 32%, 18%)" },
    orders: { label: language === "ar" ? "الطلبات" : "Orders", color: "hsl(16, 55%, 52%)" },
  };

  // ─── Peak Hours Chart ───
  const peakData = peakHours?.hours || [];

  // ─── Status Data ───
  const statusBreakdown = statusData?.statuses || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t.admin.dashboard}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {t.admin.stats.lastUpdated}: {lastUpdated.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:flex-initial">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="h-10 w-10 shrink-0 touch-manipulation sm:h-9 sm:w-9"
            aria-label={language === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {loading && !summary
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : summaryCards.map((card) => (
              <Card key={card.label} className={`bg-gradient-to-br ${card.gradient} border-border/50`}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                      <p className="text-xl font-bold tracking-tight sm:text-2xl">{card.value}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {card.change !== null && <ChangeIndicator value={card.change} language={language} />}
                        {card.sub && <span className="text-xs text-muted-foreground">{card.sub}</span>}
                      </div>
                    </div>
                    <div className={`${card.iconBg} shrink-0 rounded-xl p-2.5`}>
                      <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Revenue Over Time + Order Status */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Revenue Chart - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold">{t.admin.stats.revenueOverTime}</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {revenue?.granularity === "hourly" ? (language === "ar" ? "بالساعة" : "Hourly") : revenue?.granularity === "daily" ? (language === "ar" ? "باليوم" : "Daily") : (language === "ar" ? "بالأسبوع" : "Weekly")}
              </span>
            </div>
            {loading && !revenue ? (
              <Skeleton className="h-[220px] w-full sm:h-[280px]" />
            ) : revenueData.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-muted-foreground sm:h-[280px]">
                <BarChart3 className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">{t.admin.stats.noData}</p>
              </div>
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full sm:h-[280px]">
                <BarChart data={revenueData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : v} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => [formatPrice(Number(value), language), name === "revenue" ? (language === "ar" ? "الإيراد" : "Revenue") : (language === "ar" ? "الطلبات" : "Orders")]} />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Breakdown - 1/3 width */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                <Flame className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-semibold">{t.admin.stats.orderStatus}</h2>
            </div>
            {loading && !statusData ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : statusBreakdown.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground sm:h-[240px]">
                <Flame className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">{t.admin.stats.noData}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS_HEX[s.status] }} />
                        <span className="truncate text-sm font-medium">{ORDER_STATUS_LABELS[s.status]?.[language]}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold">{s.count}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(s.percentage)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.percentage}%`, backgroundColor: STATUS_COLORS_HEX[s.status] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Best-Selling Items + Category Breakdown + Peak Hours */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Best-Selling Items - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="shrink-0 rounded-lg bg-accent/10 p-1.5">
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
              <h2 className="font-semibold">{t.admin.stats.bestSellingItems}</h2>
            </div>
            {loading && !topItems ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Tabs defaultValue="quantity">
                <TabsList className="mb-4 w-full overflow-x-auto sm:w-auto">
                  <TabsTrigger value="quantity" className="touch-manipulation">{t.admin.stats.byQuantity}</TabsTrigger>
                  <TabsTrigger value="revenue" className="touch-manipulation">{t.admin.stats.byRevenue}</TabsTrigger>
                </TabsList>
                <TabsContent value="quantity">
                  <ItemsList items={topItems?.byQuantity || []} language={language} isArabic={isArabic} metric="quantity" />
                </TabsContent>
                <TabsContent value="revenue">
                  <ItemsList items={topItems?.byRevenue || []} language={language} isArabic={isArabic} metric="revenue" />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Peak Hours + Categories */}
        <div className="space-y-4 sm:space-y-6">
          {/* Peak Hours */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold">{t.admin.stats.peakHours}</h2>
              </div>
              {loading && !peakHours ? (
                <Skeleton className="h-[160px] w-full sm:h-[180px]" />
              ) : peakData.length === 0 ? (
                <div className="flex h-[160px] flex-col items-center justify-center text-muted-foreground sm:h-[180px]">
                  <Clock className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-xs">{t.admin.stats.noData}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1 xs:grid-cols-6 sm:grid-cols-6">
                  {peakData.map((h) => (
                    <div
                      key={h.hour}
                      className="flex flex-col items-center gap-1"
                      title={`${h.label}: ${h.count}`}
                    >
                      <div
                        className="flex aspect-square w-full items-center justify-center rounded-md text-[10px] font-bold text-white transition-colors"
                        style={{
                          backgroundColor: `hsl(153, 32%, ${18 + (1 - h.intensity) * 60}%)`,
                          opacity: h.count === 0 ? 0.2 : 0.4 + h.intensity * 0.6,
                        }}
                      >
                        {h.count > 0 ? h.count : ""}
                      </div>
                      <span className="text-[9px] leading-none text-muted-foreground">{h.hour % 3 === 0 ? `${h.hour}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold">{t.admin.stats.categoryBreakdown}</h2>
              </div>
              {loading && !topItems ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (topItems?.categories || []).length === 0 ? (
                <div className="flex h-[120px] flex-col items-center justify-center text-muted-foreground">
                  <p className="text-xs">{t.admin.stats.noData}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topItems!.categories.map((cat, idx) => {
                    const maxRev = Math.max(...topItems!.categories.map((c) => c.revenue), 1);
                    return (
                      <div key={idx}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm">{isArabic ? cat.nameAr : cat.nameEn}</span>
                          <span className="shrink-0 text-xs font-bold">{formatPrice(cat.revenue, language)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all duration-500"
                            style={{ width: `${(cat.revenue / maxRev) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Unavailable Items Alert */}
      {unavailable.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-amber-100 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-amber-800">{t.admin.stats.unavailableAlert}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unavailable.map((item) => (
                    <Badge key={item.id} variant="outline" className="border-amber-200 bg-amber-100 text-amber-800">
                      {isArabic ? item.nameAr : item.nameEn}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders Feed */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-semibold">{t.admin.stats.recentOrdersFeed}</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {language === "ar" ? "آخر 10 طلبات" : "Last 10 orders"}
            </span>
          </div>
          {loading && recentOrders.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">{t.admin.stats.noData}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-muted/50 sm:gap-3 sm:p-2.5">
                  <div className={`h-8 w-1 shrink-0 rounded-full ${STATUS_BAR_COLORS[order.status] || "bg-muted"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold">#{order.orderNumber}</span>
                      <Badge className={`${STATUS_COLORS[order.status]} px-1.5 py-0 text-[10px]`} variant="outline">
                        {ORDER_STATUS_LABELS[order.status]?.[language]}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{order.customerName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatPrice(order.total, language)}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(order.createdAt, language)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Items List Subcomponent ───

function ItemsList({ items, language, isArabic, metric }: { items: TopItem[]; language: "ar" | "en"; isArabic: boolean; metric: "quantity" | "revenue" }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <TrendingUp className="mb-2 h-10 w-10 opacity-30" />
        <p className="text-sm">{isArabic ? "لا توجد بيانات" : "No data available"}</p>
      </div>
    );
  }

  const maxVal = Math.max(...items.map((i) => (metric === "quantity" ? i.quantity : i.revenue)), 1);

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="group">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                {idx + 1}
              </span>
              <span className="truncate text-sm font-medium">{isArabic ? item.nameAr : item.nameEn}</span>
            </div>
            <span className="shrink-0 text-sm font-bold">
              {metric === "quantity" ? `${item.quantity}×` : formatPrice(item.revenue, language)}
            </span>
          </div>
          <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-muted rtl:ml-0 rtl:mr-7">
            <div
              className="h-full rounded-full bg-primary/50 transition-all duration-500"
              style={{ width: `${((metric === "quantity" ? item.quantity : item.revenue) / maxVal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}