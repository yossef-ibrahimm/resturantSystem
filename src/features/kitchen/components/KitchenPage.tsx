import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { getOrders, updateOrderStatus } from "@/lib/api";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS, ORDER_STATUS_FLOW } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UtensilsCrossed, Clock, ArrowRight, Bell, ChefHat, Flame,
  CheckCircle2, Package, LogOut, RefreshCw, Timer
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus } from "@/lib/types";

function getElapsedMinutes(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function formatElapsed(minutes: number, language: string): string {
  if (minutes < 1) return language === "ar" ? "الآن" : "Just now";
  if (minutes === 1) return language === "ar" ? "دقيقة" : "1 min";
  if (minutes < 60) return language === "ar" ? `${minutes} د` : `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return language === "ar"
    ? `${h}س ${m > 0 ? `${m}د` : ""}`
    : `${h}h ${m > 0 ? `${m}m` : ""}`;
}

export default function KitchenPage() {
  const { t, isArabic, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastNewCount, setLastNewCount] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "kitchen_staff") {
      navigate("/admin/login", { state: { from: "/kitchen" } });
    }
  }, [isAuthenticated, user, navigate]);

  // Tick every 10s for elapsed time
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const allOrders = await getOrders();
      const active = allOrders.filter((o) => o.status !== "completed");
      setOrders(active);
      setLoading(false);

      const newCount = active.filter((o) => o.status === "received").length;
      if (lastNewCount > 0 && newCount > lastNewCount) {
        toast.info(isArabic ? "!طلب جديد" : "New order!", {
          description: isArabic ? "يوجد طلب جديد في الانتظار" : "A new order is waiting",
        });
      }
      setLastNewCount(newCount);
    } catch {
      setLoading(false);
    }
  }, [lastNewCount, isArabic]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch {
      toast.error(isArabic ? "فشل تحديث الحالة" : "Failed to update status");
    }
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = ORDER_STATUS_FLOW.indexOf(current);
    if (idx < ORDER_STATUS_FLOW.length - 1) return ORDER_STATUS_FLOW[idx + 1];
    return null;
  };

  if (!isAuthenticated || user?.role !== "kitchen_staff") return null;

  const newOrders = orders.filter((o) => o.status === "received");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const columns: { key: string; title: string; orders: Order[]; icon: typeof Clock; dotColor: string; headerBg: string; border: string }[] = [
    {
      key: "received",
      title: t.kitchen.received,
      orders: newOrders,
      icon: Bell,
      dotColor: "bg-blue-500",
      headerBg: "bg-blue-500/5",
      border: "border-blue-200",
    },
    {
      key: "preparing",
      title: t.kitchen.preparing,
      orders: preparingOrders,
      icon: Flame,
      dotColor: "bg-amber-500",
      headerBg: "bg-amber-500/5",
      border: "border-amber-200",
    },
    {
      key: "ready",
      title: t.kitchen.ready,
      orders: readyOrders,
      icon: CheckCircle2,
      dotColor: "bg-emerald-500",
      headerBg: "bg-emerald-500/5",
      border: "border-emerald-200",
    },
  ];

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary rounded-lg p-2">
                  <ChefHat className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">{t.kitchen.title}</h1>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    {isArabic ? "شاشة المطبخ" : "Kitchen Display"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 rounded-full px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium">{isArabic ? "مباشر" : "LIVE"}</span>
              </div>

              {/* Order counts summary */}
              <div className="hidden sm:flex items-center gap-2">
                {columns.map(col => (
                  <div key={col.key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-medium">{col.orders.length}</span>
                  </div>
                ))}
              </div>

              {newOrders.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500 text-white rounded-full px-3 py-1.5 animate-pulse">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">{newOrders.length}</span>
                </div>
              )}

              <div className="flex items-center gap-2 border-s border-border ps-3">
                <div className="text-end">
                  <p className="text-xs font-medium">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{isArabic ? "مطبخ" : "Kitchen"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-12 bg-muted rounded-xl animate-pulse" />
                  {[1, 2].map((j) => (
                    <div key={j} className="h-52 bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
                  <ChefHat className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-xl font-semibold text-foreground mb-1">{t.kitchen.noOrders}</p>
              <p className="text-sm text-muted-foreground">
                {isArabic ? "ستظهر الطلبات الجديدة هنا" : "New orders will appear here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {columns.map((col) => (
                <div key={col.key} className="flex flex-col">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${col.headerBg} border ${col.border}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <h2 className="font-semibold text-sm">{col.title}</h2>
                    </div>
                    <span className="bg-background/80 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums">
                      {col.orders.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="space-y-3 flex-1 min-h-[200px]">
                    {col.orders.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground/40 text-sm">
                        —
                      </div>
                    ) : (
                      col.orders
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            language={language}
                            isArabic={isArabic}
                            t={t}
                            now={now}
                            onAdvance={handleStatusUpdate}
                            getNextStatus={getNextStatus}
                          />
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function OrderCard({
  order, language, isArabic, t, now, onAdvance, getNextStatus,
}: {
  order: Order;
  language: string;
  isArabic: boolean;
  t: any;
  now: number;
  onAdvance: (id: string, status: OrderStatus) => void;
  getNextStatus: (current: OrderStatus) => OrderStatus | null;
}) {
  const next = getNextStatus(order.status);
  const elapsed = getElapsedMinutes(order.createdAt);
  const isUrgent = elapsed >= 15 && order.status !== "completed";
  const isNew = order.status === "received";

  return (
    <div
      className={`group relative bg-card rounded-xl border border-border overflow-hidden transition-all hover:shadow-md ${
        isNew ? "ring-2 ring-blue-400/40 animate-pulse" : ""
      } ${isUrgent ? "ring-2 ring-red-400/40" : ""}`}
    >
      {/* Status indicator bar */}
      <div className={`absolute top-0 start-0 w-1 h-full ${
        order.status === "received" ? "bg-blue-500" :
        order.status === "preparing" ? "bg-amber-500" : "bg-emerald-500"
      }`} />

      <div className="p-4 ps-5 space-y-3">
        {/* Top Row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">#{order.orderNumber}</span>
              {isNew && (
                <span className="bg-blue-500/10 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  {isArabic ? "جديد" : "NEW"}
                </span>
              )}
              {isUrgent && (
                <span className="bg-red-500/10 text-red-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  {isArabic ? "متأخر" : "DELAYED"}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.customerName}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {order.orderType === "dine_in"
                ? `${t.kitchen.table} ${order.tableNumber}`
                : t.kitchen.takeaway}
            </Badge>
            <div className={`flex items-center gap-1 text-xs ${isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
              <Timer className="h-3 w-3" />
              {formatElapsed(elapsed, language)}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <span className="text-foreground">
                <span className="font-bold text-primary/80 me-1">{item.quantity}×</span>
                {isArabic ? item.nameAr : item.nameEn}
              </span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border/50">
            📝 {order.notes}
          </div>
        )}

        {/* Action Button */}
        {next && (
          <Button
            className="w-full font-semibold gap-2 group/btn"
            size="lg"
            onClick={() => onAdvance(order.id, next)}
          >
            {isArabic ? "تأكيد" : "Mark as"} {ORDER_STATUS_LABELS[next][language]}
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 rtl:-scale-x-100" />
          </Button>
        )}
      </div>
    </div>
  );
}
