import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { getDashboardStats } from "@/lib/api";
import { formatPrice, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart, DollarSign, TrendingUp, Clock, ArrowUpRight,
  UtensilsCrossed, Truck, BarChart3, Calendar
} from "lucide-react";
import type { DashboardStats, Order } from "@/lib/types";

function getGreeting(language: string): string {
  const hour = new Date().getHours();
  if (language === "ar") {
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء الخير";
  }
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getTodayDate(language: string): string {
  const now = new Date();
  if (language === "ar") {
    return now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  return now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function AdminDashboard() {
  const { t, isArabic, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDashboardStats()
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <BarChart3 className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-lg font-medium text-foreground mb-2">{t.error}</p>
        <p className="text-sm text-muted-foreground mb-4">
          {isArabic ? "تعذر تحميل البيانات" : "Failed to load dashboard data"}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const dineInCount = stats.recentOrders.filter(o => o.orderType === "dine_in").length;
  const takeawayCount = stats.recentOrders.filter(o => o.orderType === "takeaway").length;
  const activeOrders = stats.recentOrders.filter(o => o.status !== "completed").length;
  const maxCount = Math.max(...stats.topItems.map(i => i.count), 1);

  const statCards = [
    {
      label: t.admin.stats.todayOrders,
      value: stats.todayOrders,
      icon: ShoppingCart,
      gradient: "from-blue-500/10 to-blue-600/5",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      subtext: activeOrders > 0
        ? (isArabic ? `${activeOrders} نشط` : `${activeOrders} active`)
        : (isArabic ? "لا يوجد نشط" : "No active"),
    },
    {
      label: t.admin.stats.todayRevenue,
      value: formatPrice(stats.todayRevenue, language),
      icon: DollarSign,
      gradient: "from-emerald-500/10 to-emerald-600/5",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      subtext: isArabic ? "اليوم" : "Today",
    },
    {
      label: isArabic ? "صالة" : "Dine-in",
      value: dineInCount,
      icon: UtensilsCrossed,
      gradient: "from-amber-500/10 to-amber-600/5",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      subtext: ORDER_TYPE_LABELS.dine_in[language],
    },
    {
      label: isArabic ? "تيك أواي" : "Takeaway",
      value: takeawayCount,
      icon: Truck,
      gradient: "from-violet-500/10 to-violet-600/5",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
      subtext: ORDER_TYPE_LABELS.takeaway[language],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting(language)}, <span className="text-primary">{isArabic ? "أحمد" : "Ahmed"}</span>
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {getTodayDate(language)}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border-border/50 hover:shadow-md transition-shadow`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                </div>
                <div className={`${stat.iconBg} rounded-xl p-2.5`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Items + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Items - 2 cols */}
        <Card className="lg:col-span-2">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-accent/10 rounded-lg p-1.5">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <h2 className="font-semibold">{t.admin.stats.topItems}</h2>
              </div>
              <Badge variant="secondary" className="text-xs">
                {isArabic ? `${stats.topItems.length} أصناف` : `${stats.topItems.length} items`}
              </Badge>
            </div>
          </div>
          <CardContent className="px-6 pb-6">
            {stats.topItems.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t.admin.orders.noOrders}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topItems.map((item, idx) => (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{item.count}x</span>
                    </div>
                    <div className="ml-9 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 rounded-lg p-1.5">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-semibold">{t.admin.stats.recentOrders}</h2>
            </div>
          </div>
          <CardContent className="px-6 pb-6">
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t.admin.orders.noOrders}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {stats.recentOrders.map((order) => (
                  <OrderRow key={order.id} order={order} language={language} isArabic={isArabic} t={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrderRow({ order, language, isArabic, t }: { order: Order; language: string; isArabic: boolean; t: any }) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors cursor-default group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">#{order.orderNumber}</span>
          <Badge className={`${STATUS_COLORS[order.status]} text-[10px] px-1.5 py-0`} variant="outline">
            {ORDER_STATUS_LABELS[order.status][language]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{order.customerName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">{timeAgo(order.createdAt, language)}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {order.items.length} {isArabic ? "أصناف" : "items"}
        </p>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </div>
  );
}
