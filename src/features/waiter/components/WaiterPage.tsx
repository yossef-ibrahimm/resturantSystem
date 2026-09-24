import { useState, useEffect , useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore } from "@/stores/authStore";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { formatPrice, getElapsedMinutes, formatElapsed } from "@/lib/utils";
import { useOrders, useUpdateOrderStatus, useAcknowledgeBill } from "@/hooks/useOrders";
import { getReportStaleTables } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  ClipboardCheck,
  CreditCard,
  LogOut,
  ReceiptText,
  CheckCircle2,
  Timer,
  AlertTriangle,
  ChefHat,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import AttendanceToggle from "@/features/attendance/components/AttendanceToggle";
import CashierPaymentDialog from "@/features/cashier/components/CashierPaymentDialog";
import type { Order } from "@/lib/types";
import type { StaleTableReport } from "@/lib/report-types";
import type { TranslationKeys } from "@/i18n/ar";

export default function WaiterPage() {
  const { t, isArabic, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [lastBillCount, setLastBillCount] = useState(0);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [staleTables, setStaleTables] = useState<StaleTableReport["staleTables"]>([]);

  const { data: allOrders = [], isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const acknowledgeBillMut = useAcknowledgeBill();

  // Tick every 10s purely to keep "elapsed time" badges fresh; doesn't affect
  // the memoized order buckets below, since those only depend on allOrders.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);

  // Fetch stale tables periodically
  useEffect(() => {
    const fetchStaleTables = async () => {
      try {
        const data = await getReportStaleTables();
        setStaleTables(data.staleTables || []);
      } catch {
        // Silently fail - stale tables is non-critical
      }
    };

    fetchStaleTables();
    const interval = setInterval(fetchStaleTables, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const orders = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.status !== "cancelled" &&
          (o.status !== "completed" || (o.billRequested && o.paymentStatus !== "paid")),
      ),
    [allOrders],
  );

  const readyForDelivery = useMemo(
    () => orders.filter((o) => o.status === "ready" && !o.billRequested),
    [orders],
  );
  const billRequested = useMemo(
    () => orders.filter((o) => o.billRequested && o.paymentStatus !== "paid"),
    [orders],
  );
  const completedUnpaid = useMemo(
    () => allOrders.filter((o) => o.status === "completed" && o.paymentStatus === "unpaid"),
    [allOrders],
  );
  const inKitchen = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          o.status !== "completed" &&
          o.status !== "ready" &&
          !o.billRequested,
      ),
    [orders],
  );

  useEffect(() => {
    const billCount = billRequested.length;
    if (lastBillCount > 0 && billCount > lastBillCount) {
      toast.info(isArabic ? "!فاتورة جديدة" : "New bill request!", {
        description: isArabic ? "عميل يطلب الفاتورة" : "A customer is requesting the bill",
      });
    }
    setLastBillCount(billCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billRequested.length, isArabic]);

  // Keeps the realtime connection alive; actual cache invalidation on
  // "order:new" / "order:updated" is handled globally by useOrders' socket
  // subscription, so no local listeners are needed here.
  useEffect(() => {
    const isAuthenticated = useAuthStore.getState().user !== null;
    if (!isAuthenticated) return;

    connectSocket();
    return () => disconnectSocket();
  }, []);

  const handleDeliver = (orderId: string) => {
    updateStatus.mutate(
      { id: orderId, status: "completed" },
      {
        onSuccess: () => toast.success(isArabic ? "تم التسليم" : "Order delivered"),
        onError: () => toast.error(isArabic ? "فشل تحديث الحالة" : "Failed to update status"),
      },
    );
  };

  const handleAcknowledgeBill = (orderId: string) => {
    acknowledgeBillMut.mutate(orderId, {
      onSuccess: () => toast.success(isArabic ? "تم تحصيل الفاتورة" : "Bill collected"),
      onError: () => toast.error(isArabic ? "فشل تحصيل الفاتورة" : "Failed to acknowledge bill"),
    });
  };

  const openPayment = (order: Order) => setPaymentOrder(order);
  const closePayment = () => setPaymentOrder(null);

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
      key: "unpaid",
      title: isArabic ? "غير محاسب" : "Unpaid",
      orders: completedUnpaid,
      icon: CreditCard,
      dotColor: "bg-amber-500",
      headerBg: "bg-amber-500/5",
      border: "border-amber-200",
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
    <div className="flex min-h-screen flex-col bg-muted/30" dir={isArabic ? "rtl" : "ltr"}>
      {/* ---------- HEADER ---------- */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:justify-between lg:gap-6">
            {/* Title block */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 sm:h-12 sm:w-12">
                <ReceiptText className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight sm:text-xl">
                  {t.waiter.title}
                </h1>
                <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  {t.waiter.subtitle}
                </p>
              </div>
            </div>

            {/* Right cluster: on mobile it wraps to its own scrollable row */}
            <div className="col-span-2 -mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:col-span-1 lg:mx-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0">
              {/* live badge */}
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 sm:text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {isArabic ? "مباشر" : "LIVE"}
              </span>

              {/* per-column counters */}
              <div className="flex shrink-0 items-center gap-2">
                {columns.map((col) => (
                  <span
                    key={col.key}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium sm:text-xs"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${col.dotColor}`} />
                    <span className="hidden sm:inline">{col.title}</span>
                    <span className="font-bold">{col.orders.length}</span>
                  </span>
                ))}
              </div>

              {/* bill alert */}
              {billRequested.length > 0 && (
                <span
                  className="inline-flex shrink-0 animate-pulse items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-600 sm:text-xs"
                  role="status"
                  aria-live="polite"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {billRequested.length}
                </span>
              )}

              {/* stale tables alert */}
              {staleTables.length > 0 && (
                <span
                  className="inline-flex shrink-0 animate-pulse items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-600 sm:text-xs"
                  role="status"
                  aria-live="polite"
                  title={staleTables.map((t) => `Table ${t.number} - ${t.elapsedMinutes}min`).join(", ")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {staleTables.length}
                </span>
              )}

              <div className="shrink-0">
                <AttendanceToggle />
              </div>

              <div className="ms-auto flex shrink-0 items-center gap-2 ps-1 lg:ms-0">
                <div className="hidden min-w-0 text-end sm:block">
                  <p className="max-w-[140px] truncate text-sm font-semibold leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isArabic ? "جرسون" : "Waiter"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLogout}
                  aria-label={isArabic ? "تسجيل الخروج" : "Log out"}
                  className="h-9 w-9 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- BODY ---------- */}
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
                  <Skeleton className="h-9 w-2/3" />
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="h-40 w-full rounded-xl" />
                  ))}
                </div>
              ))}
            </div>
          ) : orders.length === 0 && completedUnpaid.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
              <div className="relative mb-5">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-muted sm:h-24 sm:w-24">
                  <ReceiptText className="h-9 w-9 text-muted-foreground sm:h-10 sm:w-10" />
                </div>
                <div className="absolute -end-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full border-4 border-background bg-emerald-500">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              </div>
              <h2 className="text-lg font-bold sm:text-xl">{t.waiter.noOrders}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {isArabic ? "ستظهر الطلبات هنا" : "Orders will appear here"}
              </p>
            </div>
          ) : readyForDelivery.length === 0 &&
            billRequested.length === 0 &&
            completedUnpaid.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
              <div className="relative mb-5">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-amber-500/10 sm:h-24 sm:w-24">
                  <ChefHat className="h-9 w-9 text-amber-600 sm:h-10 sm:w-10" />
                </div>
                <div className="absolute -end-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full border-4 border-background bg-amber-500">
                  <Timer className="h-4 w-4 text-white" />
                </div>
              </div>
              <h2 className="text-lg font-bold sm:text-xl">
                {isArabic ? "الطلبات في المطبخ" : "Orders in the kitchen"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {inKitchen.length > 0
                  ? isArabic
                    ? `${inKitchen.length} ${inKitchen.length === 1 ? "طلب" : "طلبات"} قيد التحضير`
                    : `${inKitchen.length} order${inKitchen.length === 1 ? "" : "s"} being prepared`
                  : isArabic
                    ? "لا توجد طلبات جاهزة للتسليم حالياً"
                    : "No orders ready for delivery right now"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-5">
              {columns.map((col) => (
                <section
                  key={col.key}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card ${col.border}`}
                >
                  {/* column header */}
                  <div
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 sm:px-4 sm:py-3 ${col.headerBg}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <col.icon className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
                      <h2 className="truncate text-sm font-bold sm:text-base">{col.title}</h2>
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {col.orders.length}
                    </Badge>
                  </div>

                  {/* column body */}
                  <div className="grid min-w-0 gap-3 p-3 sm:p-4 xl:grid-cols-2">
                    {col.orders.length === 0 ? (
                      <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                        —
                      </div>
                    ) : (
                      [...col.orders]
                        .sort(
                          (a, b) =>
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                        )
                        .map((order) => (
                          <WaiterOrderCard
                            key={order.id}
                            order={order}
                            language={language as "ar" | "en"}
                            isArabic={isArabic}
                            t={t}
                            now={now}
                            isBillRequest={col.key === "bill"}
                            isUnpaid={col.key === "unpaid"}
                            onDeliver={handleDeliver}
                            onAcknowledgeBill={handleAcknowledgeBill}
                            onPay={openPayment}
                          />
                        ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Payment Dialog */}
      <CashierPaymentDialog
        order={paymentOrder}
        onClose={closePayment}
        hasOpenShift={true}
      />
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
  isUnpaid,
  onDeliver,
  onPay,
}: {
  order: Order;
  language: "ar" | "en";
  isArabic: boolean;
  t: TranslationKeys;
  now: number;
  isBillRequest: boolean;
  isUnpaid: boolean;
  onDeliver: (id: string) => void;
  onAcknowledgeBill: (id: string) => void;
  onPay: (order: Order) => void;
}) {
  // `now` isn't read directly — it's here purely to force this card to
  // re-render every 10s so the elapsed-time badge below stays live.
  void now;
  const elapsed = getElapsedMinutes(order.createdAt);
  const isLate = elapsed >= 15;
  const remaining = Math.max(0, order.total - order.paidTotal);

  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md">
      <span
        className={`absolute inset-x-0 top-0 h-1 ${isBillRequest ? "bg-orange-500" : isUnpaid ? "bg-amber-500" : "bg-emerald-500"}`}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 pt-4 sm:p-4 sm:pt-5">
        {/* top row */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-base font-black tabular-nums sm:text-lg">
                #{order.orderNumber}
              </span>
              {isBillRequest && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  {isArabic ? "فاتورة" : "BILL"}
                </span>
              )}
              {isUnpaid && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {isArabic ? "غير محاسب" : "UNPAID"}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{order.customerName}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant="outline" className="whitespace-nowrap text-[11px]">
              {order.orderType === "dine_in"
                ? `${t.waiter.table} ${order.tableNumber}`
                : t.waiter.takeaway}
            </Badge>
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium tabular-nums ${
                isLate ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              <Timer className="h-3 w-3" />
              {formatElapsed(elapsed, language)}
            </span>
          </div>
        </div>

        {/* items */}
        <ul className="min-w-0 space-y-1 rounded-lg bg-muted/50 p-2.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex min-w-0 items-start gap-2 text-sm">
              <span className="shrink-0 font-bold tabular-nums text-primary">
                {item.quantity}×
              </span>
              <span className="min-w-0 break-words">{isArabic ? item.nameAr : item.nameEn}</span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-700 break-words">
            📝 {order.notes}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.waiter.total}
          </span>
          <span className="truncate text-base font-black tabular-nums sm:text-lg">
            {formatPrice(order.total, language)}
          </span>
        </div>

        {isBillRequest || isUnpaid ? (
          <Button
            className="h-11 w-full gap-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600"
            onClick={() => onPay(order)}
          >
            <CreditCard className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {isArabic ? "دفع الحساب" : "Pay Bill"} — {formatPrice(remaining, language)}
            </span>
          </Button>
        ) : (
          <Button
            className="h-11 w-full gap-2 text-sm font-semibold"
            onClick={() => onDeliver(order.id)}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{t.waiter.markAsDelivered}</span>
          </Button>
        )}
      </div>
    </article>
  );
}