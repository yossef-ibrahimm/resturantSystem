import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { getOrders, updateOrderStatus, acknowledgeBill } from "@/lib/api";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "@/lib/constants";
import { connectSocket, disconnectSocket, onSocketEvent } from "@/lib/socket";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell, ClipboardCheck, CreditCard, LogOut, ReceiptText,
  CheckCircle2, Timer, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/ar";

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

export default function WaiterPage() {
  const { t, isArabic, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [lastBillCount, setLastBillCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "waiter") {
      navigate("/admin/login", { state: { from: "/waiter" } });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  const loadOrdersRef = useRef<() => void>(() => {});

  const loadOrders = useCallback(async () => {
    try {
      const allOrders = await getOrders();
      const relevant = allOrders.filter(
        (o) => o.status !== "completed" || (o.billRequested && o.paymentStatus !== "paid")
      );
      setOrders(relevant);
      setLoading(false);

      const billCount = relevant.filter((o) => o.billRequested && o.paymentStatus !== "paid").length;
      if (lastBillCount > 0 && billCount > lastBillCount) {
        toast.info(isArabic ? "!فاتورة جديدة" : "New bill request!", {
          description: isArabic ? "عميل يطلب الفاتورة" : "A customer is requesting the bill",
        });
      }
      setLastBillCount(billCount);
    } catch {
      setLoading(false);
    }
  }, [lastBillCount, isArabic]);

  loadOrdersRef.current = loadOrders;

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // WebSocket real-time updates (polling remains as fallback)
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    connectSocket(token);

    const unsubNew = onSocketEvent("order:new", () => loadOrdersRef.current());
    const unsubUpdated = onSocketEvent("order:updated", () => loadOrdersRef.current());

    return () => {
      unsubNew();
      unsubUpdated();
      disconnectSocket();
    };
  }, []);

  const handleDeliver = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, "completed");
      loadOrders();
      toast.success(isArabic ? "تم التسليم" : "Order delivered");
    } catch {
      toast.error(isArabic ? "فشل تحديث الحالة" : "Failed to update status");
    }
  };

  const handleAcknowledgeBill = async (orderId: string) => {
    try {
      await acknowledgeBill(orderId);
      loadOrders();
      toast.success(isArabic ? "تم تحصيل الفاتورة" : "Bill collected");
    } catch {
      toast.error(isArabic ? "فشل تحصيل الفاتورة" : "Failed to acknowledge bill");
    }
  };

  if (!isAuthenticated || user?.role !== "waiter") return null;

  const readyForDelivery = orders.filter(
    (o) => o.status === "ready" && !o.billRequested
  );
  const billRequested = orders.filter(
    (o) => o.billRequested && o.paymentStatus !== "paid"
  );

  const columns: {
    key: string;
    title: string;
    orders: Order[];
    icon: typeof Bell;
    dotColor: string;
    headerBg: string;
    border: string;
  }[] = [
    {
      key: "bill",
      title: t.waiter.billRequested,
      orders: billRequested,
      icon: CreditCard,
      dotColor: "bg-orange-500",
      headerBg: "bg-orange-500/5",
      border: "border-orange-200",
    },
    {
      key: "ready",
      title: t.waiter.readyForDelivery,
      orders: readyForDelivery,
      icon: ClipboardCheck,
      dotColor: "bg-emerald-500",
      headerBg: "bg-emerald-500/5",
      border: "border-emerald-200",
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary rounded-lg p-2">
                  <ReceiptText className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">{t.waiter.title}</h1>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    {t.waiter.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 rounded-full px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium">{isArabic ? "مباشر" : "LIVE"}</span>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-medium">{col.orders.length}</span>
                  </div>
                ))}
              </div>

              {billRequested.length > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500 text-white rounded-full px-3 py-1.5 animate-pulse">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">{billRequested.length}</span>
                </div>
              )}

              <div className="flex items-center gap-2 border-s border-border ps-3">
                <div className="text-end">
                  <p className="text-xs font-medium">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{isArabic ? "جرسون" : "Waiter"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2].map((i) => (
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
                  <ReceiptText className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-xl font-semibold text-foreground mb-1">{t.waiter.noOrders}</p>
              <p className="text-sm text-muted-foreground">
                {isArabic ? "ستظهر الطلبات هنا" : "Orders will appear here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {columns.map((col) => (
                <div key={col.key} className="flex flex-col">
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${col.headerBg} border ${col.border}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <h2 className="font-semibold text-sm">{col.title}</h2>
                    </div>
                    <span className="bg-background/80 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums">
                      {col.orders.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 min-h-[200px]">
                    {col.orders.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground/40 text-sm">
                        —
                      </div>
                    ) : (
                      [...col.orders]
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((order) => (
                          <WaiterOrderCard
                            key={order.id}
                            order={order}
                            language={language}
                            isArabic={isArabic}
                            t={t}
                            now={now}
                            isBillRequest={col.key === "bill"}
                            onDeliver={handleDeliver}
                            onAcknowledgeBill={handleAcknowledgeBill}
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

function WaiterOrderCard({
  order,
  language,
  isArabic,
  t,
  now,
  isBillRequest,
  onDeliver,
  onAcknowledgeBill,
}: {
  order: Order;
  language: string;
  isArabic: boolean;
  t: TranslationKeys;
  now: number;
  isBillRequest: boolean;
  onDeliver: (id: string) => void;
  onAcknowledgeBill: (id: string) => void;
}) {
  const elapsed = getElapsedMinutes(order.createdAt);
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <div className="group relative bg-card rounded-xl border border-border overflow-hidden transition-all hover:shadow-md">
      <div className={`absolute top-0 start-0 w-1 h-full ${
        isBillRequest ? "bg-orange-500" : "bg-emerald-500"
      }`} />

      <div className="p-4 ps-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">#{order.orderNumber}</span>
              {isBillRequest && (
                <span className="bg-orange-500/10 text-orange-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {isArabic ? "فاتورة" : "BILL"}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-0.5">{order.customerName}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {order.orderType === "dine_in"
                ? `${t.waiter.table} ${order.tableNumber}`
                : t.waiter.takeaway}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              {formatElapsed(elapsed, language)}
            </div>
          </div>
        </div>

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

        {order.notes && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border/50">
            📝 {order.notes}
          </div>
        )}

        <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-border/50">
          <span>{t.waiter.total}</span>
          <span>{formatPrice(total, language)}</span>
        </div>

        {isBillRequest ? (
          <Button
            className="w-full font-semibold gap-2 group/btn"
            size="lg"
            variant="default"
            onClick={() => onAcknowledgeBill(order.id)}
          >
            <CreditCard className="h-4 w-4" />
            {t.waiter.acknowledgeBill}
          </Button>
        ) : (
          <Button
            className="w-full font-semibold gap-2 group/btn"
            size="lg"
            onClick={() => onDeliver(order.id)}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t.waiter.markAsDelivered}
          </Button>
        )}
      </div>
    </div>
  );
}
