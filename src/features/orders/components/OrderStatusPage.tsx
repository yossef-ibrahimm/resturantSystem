import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { getOrderByToken, requestBillByToken } from "@/lib/api";
import { formatPrice, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { useActiveOrderStore } from "@/stores/activeOrderStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Package, ReceiptText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/lib/types";

export default function OrderStatusPage() {
  const { t, isArabic, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeToken = useActiveOrderStore((s) => s.orderToken);
  const initialOrder = searchParams.get("token") || storeToken || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const notFoundRef = useRef(false);
  const orderTokenRef = useRef(initialOrder.trim());
  const [billLoading, setBillLoading] = useState(false);
  const { updateStatus, clearOrder } = useActiveOrderStore();

  useEffect(() => {
    const token = initialOrder.trim();
    if (!token) return;
    orderTokenRef.current = token;
    fetchOrder(token);

    const interval = setInterval(() => {
      if (notFoundRef.current) return;
      const current = orderTokenRef.current;
      if (current) fetchOrder(current);
    }, 5000);

    return () => clearInterval(interval);
  }, [initialOrder]);

  useEffect(() => {
    if (order && order.paymentStatus === "paid") {
      clearOrder();
      setOrder(null);
    }
  }, [order, clearOrder]);

  const fetchOrder = async (token: string) => {
    setLoading(true);
    setNotFound(false);
    notFoundRef.current = false;
    try {
      const found = await getOrderByToken(token);
      if (found) {
        if (found.paymentStatus === "paid") {
          setOrder(null);
          clearOrder();
          return;
        }
        setOrder(found);
        setSearchParams({ token: found.orderToken });
        updateStatus(found.status);
      } else {
        setOrder(null);
        setNotFound(true);
        notFoundRef.current = true;
      }
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.message?.includes("Too Many")) return;
      // Only stop polling on actual 404, not on transient errors
      if (err?.message?.includes("404") || err?.status === 404) {
        setNotFound(true);
        notFoundRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  const currentStep = order ? (ORDER_STATUS_FLOW as readonly string[]).indexOf(order.status) : 0;

  const handleRequestBill = async () => {
    if (!order) return;
    setBillLoading(true);
    try {
      const updated = await requestBillByToken(order.orderToken);
      setOrder(updated);
      toast.success(t.orderStatus.billRequestedSuccess);
    } catch {
      toast.error(isArabic ? "فشل إرسال الطلب" : "Failed to send request");
    } finally {
      setBillLoading(false);
    }
  };

  const canRequestBill = order && order.paymentStatus === "unpaid" && !order.billRequested;

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-1.5">{t.orderStatus.title}</h1>
      <p className="text-muted-foreground mb-8 text-sm">{t.orderStatus.enterNumberPrompt}</p>

      {/* Not found */}
      {notFound && (
        <EmptyState
          icon={Package}
          title={t.orderStatus.notFound}
        />
      )}

      {/* Order details */}
      {order && (
        <div className="space-y-6">
          {/* Status Progress */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t.orderStatus.orderNumber}</p>
                  <p className="text-2xl font-bold">#{order.orderNumber}</p>
                </div>
                <Badge className={STATUS_COLORS[order.status]}>
                  {ORDER_STATUS_LABELS[order.status][language]}
                </Badge>
              </div>

              {/* Cancelled banner — replaces progress bar (Phase 1) */}
              {order.status === "cancelled" ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-5 text-center">
                  <p className="font-semibold text-destructive mb-1">
                    {isArabic ? "تم إلغاء هذا الطلب" : "This order was cancelled"}
                  </p>
                  {order.cancelReason && (
                    <p className="text-sm text-destructive/80">
                      {order.cancelReason}
                    </p>
                  )}
                </div>
              ) : (
              <div className="relative">
                <div className="flex items-center justify-between">
                  {ORDER_STATUS_FLOW.map((status, idx) => (
                    <div key={status} className="flex flex-col items-center z-10">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                          idx <= currentStep
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className="text-xs mt-1.5 text-center whitespace-nowrap font-medium">
                        {ORDER_STATUS_LABELS[status][language]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="absolute top-[18px] left-[18px] right-[18px] h-0.5 bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${(currentStep / (ORDER_STATUS_FLOW.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.orderStatus.orderDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">{t.orderStatus.orderType}</p>
                  <p className="font-medium">{ORDER_TYPE_LABELS[order.orderType][language]}</p>
                </div>
                {order.tableNumber && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">{t.orderStatus.tableNumber}</p>
                    <p className="font-medium">{order.tableNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">{t.checkout.customerName}</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">{t.kitchen.time}</p>
                  <p className="font-medium">{timeAgo(order.createdAt, language)}</p>
                </div>
              </div>

              {order.notes && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">{t.kitchen.notes}</p>
                  <p className="font-medium text-sm">{order.notes}</p>
                </div>
              )}

              <Separator className="my-4" />

              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">{t.orderStatus.items}</p>
                <div className="space-y-2.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground/80">
                        {isArabic ? item.nameAr : item.nameEn} × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(item.unitPrice * item.quantity, language)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold text-lg">
                <span>{t.orderStatus.total}</span>
                <span className="text-accent">
                  {formatPrice(order.total, language)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Request Bill Button */}
          {canRequestBill && (
            <Button
              size="lg"
              className="w-full gap-2"
              variant="outline"
              onClick={handleRequestBill}
              disabled={billLoading}
            >
              <ReceiptText className="h-5 w-5" />
              {t.orderStatus.requestBill}
            </Button>
          )}

          {order.billRequested && (
            <Card className="border-[hsl(var(--status-preparing-border))] bg-[hsl(var(--status-preparing-bg)/0.3)]">
              <CardContent className="py-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-[hsl(var(--status-preparing-fg))]" />
                <p className="font-semibold text-[hsl(var(--status-preparing-fg))]">{t.orderStatus.billRequested}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
