import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore } from "@/stores/authStore";
import { ORDER_STATUS_LABELS, ORDER_STATUS_FLOW } from "@/lib/constants";
import { connectSocket, disconnectSocket, onSocketEvent } from "@/lib/socket";
import { getElapsedMinutes, formatElapsed } from "@/lib/utils";
import { useOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, Bell, ChefHat, Flame,
  CheckCircle2, LogOut, Timer,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";
import AttendanceToggle from "@/features/attendance/components/AttendanceToggle";
import type { Order, OrderStatus } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/ar";

export default function KitchenPage() {
  const { t, isArabic, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [lastNewCount, setLastNewCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [activeColumn, setActiveColumn] = useState<string>("received");

  const { data: allOrders = [], isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();

  const orders = allOrders.filter((o) => o.status !== "completed" && o.status !== "cancelled");

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const newCount = orders.filter((o) => o.status === "received").length;
    if (lastNewCount > 0 && newCount > lastNewCount) {
      toast.info(isArabic ? "!طلب جديد" : "New order!", {
        description: isArabic ? "يوجد طلب جديد في الانتظار" : "A new order is waiting",
      });
    }
    setLastNewCount(newCount);
  }, [orders, lastNewCount, isArabic]);

  useEffect(() => {
    const isAuthenticated = useAuthStore.getState().user !== null;
    if (!isAuthenticated) return;

    connectSocket();

    const unsubNew = onSocketEvent("order:new", () => {});
    const unsubUpdated = onSocketEvent("order:updated", () => {});

    return () => {
      unsubNew();
      unsubUpdated();
      disconnectSocket();
    };
  }, []);

  const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    updateStatus.mutate(
      { id: orderId, status: newStatus },
      {
        onError: () => {
          toast.error(isArabic ? "فشل تحديث الحالة" : "Failed to update status");
        },
      }
    );
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const flow = ORDER_STATUS_FLOW as readonly string[];
    const idx = flow.indexOf(current);
    if (idx >= 0 && idx < flow.length - 1) return ORDER_STATUS_FLOW[idx + 1];
    return null;
  };

  const newOrders = orders.filter((o) => o.status === "received");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const columns: { key: string; title: string; orders: Order[]; icon: LucideIcon; dotColor: string; headerBg: string; border: string; activeBg: string }[] = [
    {
      key: "received",
      title: t.kitchen.received,
      orders: newOrders,
      icon: Bell,
      dotColor: "bg-blue-500",
      headerBg: "bg-blue-500/5",
      border: "border-blue-200",
      activeBg: "bg-blue-500 text-white border-blue-500",
    },
    {
      key: "preparing",
      title: t.kitchen.preparing,
      orders: preparingOrders,
      icon: Flame,
      dotColor: "bg-amber-500",
      headerBg: "bg-amber-500/5",
      border: "border-amber-200",
      activeBg: "bg-amber-500 text-white border-amber-500",
    },
    {
      key: "ready",
      title: t.kitchen.ready,
      orders: readyOrders,
      icon: CheckCircle2,
      dotColor: "bg-emerald-500",
      headerBg: "bg-emerald-500/5",
      border: "border-emerald-200",
      activeBg: "bg-emerald-500 text-white border-emerald-500",
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {/* Brand */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="bg-primary rounded-lg p-1.5 sm:p-2 shrink-0">
                <ChefHat className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight truncate">{t.kitchen.title}</h1>
                <p className="hidden sm:block text-[11px] text-muted-foreground -mt-0.5">
                  {isArabic ? "شاشة المطبخ" : "Kitchen Display"}
                </p>
              </div>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end ms-auto">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 rounded-full px-2 sm:px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden xs:inline sm:inline text-xs font-medium">{isArabic ? "مباشر" : "LIVE"}</span>
              </div>

              {/* Order counts summary (tablet+) */}
              <div className="hidden md:flex items-center gap-2">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-medium">{col.orders.length}</span>
                  </div>
                ))}

              </div>

              {newOrders.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500 text-white rounded-full px-2.5 sm:px-3 py-1.5 animate-pulse">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">{newOrders.length}</span>
                </div>
              )}

              <AttendanceToggle />

              <div className="flex items-center gap-2 border-s border-border ps-2 sm:ps-3">
                <div className="hidden sm:block text-end max-w-[8rem]">
                  <p className="text-xs font-medium truncate">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{isArabic ? "مطبخ" : "Kitchen"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8 shrink-0"
                  onClick={handleLogout}
                  aria-label={isArabic ? "تسجيل الخروج" : "Log out"}
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / tablet column switcher */}
        <div className="md:hidden border-t border-border/60 px-2 py-2 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {columns.map((col) => {
              const isActive = activeColumn === col.key;
              const Icon = col.icon;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setActiveColumn(col.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive ? col.activeBg : `bg-background ${col.border} text-foreground/70`
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {col.title}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      isActive ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    {col.orders.length}
                  </span>
                </button>
              );
            })}

          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-5 lg:p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`space-y-3 ${i === 1 ? "" : "hidden md:block"}`}>
                  <Skeleton className="h-12 w-full rounded-xl" />
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="h-52 w-full rounded-xl" />
                  ))}
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 sm:py-32 text-center px-4">
              <div className="relative mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted/50 flex items-center justify-center">
                  <ChefHat className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-semibold text-foreground mb-1">{t.kitchen.noOrders}</p>
              <p className="text-sm text-muted-foreground">
                {isArabic ? "ستظهر الطلبات الجديدة هنا" : "New orders will appear here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={`${col.key === activeColumn ? "flex" : "hidden"} md:flex flex-col`}
                >
                  {/* Column Header */}
                  <div className={`hidden md:flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${col.headerBg} border ${col.border}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <h2 className="font-semibold text-sm">{col.title}</h2>
                    </div>
                    <span className="bg-background/80 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums">
                      {col.orders.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="space-y-3 flex-1 min-h-[200px] w-full">
                    {col.orders.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground/40 text-sm">
                        —
                      </div>
                    ) : (
                      [...col.orders]
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
  t: TranslationKeys;
  now: number;
  onAdvance: (id: string, status: OrderStatus) => void;
  getNextStatus: (current: OrderStatus) => OrderStatus | null;
}) {
  void now;
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

      <div className="p-3.5 sm:p-4 ps-4 sm:ps-5 space-y-2.5 sm:space-y-3">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold tracking-tight">#{order.orderNumber}</span>
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
            <p className="text-sm font-medium text-foreground mt-0.5 truncate">{order.customerName}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
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
            <div key={item.id} className="flex justify-between items-start text-sm gap-2">
              <span className="text-foreground break-words">
                <span className="font-bold text-primary/80 me-1">{item.quantity}×</span>
                {isArabic ? item.nameAr : item.nameEn}
              </span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border/50 break-words">
            📝 {order.notes}
          </div>
        )}

        {/* Action Button */}
        {next && (
          <Button
            className="w-full font-semibold gap-2 group/btn min-h-[44px]"
            size="lg"
            onClick={() => onAdvance(order.id, next)}
          >
            <span className="truncate">
              {isArabic ? "تأكيد" : "Mark as"} {ORDER_STATUS_LABELS[next]?.[language as "ar" | "en"] ?? next}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover/btn:translate-x-0.5 rtl:-scale-x-100" />
          </Button>
        )}
      </div>
    </div>
  );
}