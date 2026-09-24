import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import { getOrders, getOrderPayments, refundPayment, applyDiscount } from "@/lib/api";
import { formatPrice, formatDate, timeAgo } from "@/lib/utils";
import { orderTotal, itemsSubtotal } from "@/lib/money";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/EmptyState";
import { useCancelOrder } from "@/hooks/useOrders";
import { toast } from "sonner";
import { ClipboardList, RotateCcw } from "lucide-react";
import { z } from "zod";
import type { Order } from "@/lib/types";

const cancelReasonSchema = z.string().trim().min(1, "Reason is required").max(280, "Reason must be at most 280 characters");
const refundAmountSchema = z.coerce.number().positive("Amount must be greater than 0");
const refundReasonSchema = z.string().trim().min(1, "Reason is required").max(280, "Reason must be at most 280 characters");
const discountAmountSchema = z.coerce.number().positive("Amount must be greater than 0");
const discountReasonSchema = z.string().trim().min(1, "Reason is required").max(280, "Reason must be at most 280 characters");

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
}

export default function OrderHistory() {
  const { t, isArabic, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [refundMode, setRefundMode] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "wallet" | "other">("other");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundErrors, setRefundErrors] = useState<{ amount?: string; reason?: string }>({});
  const [orderPayments, setOrderPayments] = useState<PaymentRecord[]>([]);
  const [discountMode, setDiscountMode] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountErrors, setDiscountErrors] = useState<{ amount?: string; reason?: string }>({});

  const cancelOrderMutation = useCancelOrder();

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const result = cancelReasonSchema.safeParse(cancelReason);
    if (!result.success) {
      setCancelError(result.error.errors[0].message);
      return;
    }
    setCancelError("");
    cancelOrderMutation.mutate(
      { id: selectedOrder.id, reason: result.data },
      {
        onSuccess: () => {
          toast.success(isArabic ? "تم إلغاء الطلب" : "Order cancelled");
          setSelectedOrder(null);
          setCancelMode(false);
          setCancelReason("");
          loadOrders();
        },
        onError: () => toast.error(t.error),
      }
    );
  };

  const handleRefund = async () => {
    const amountResult = refundAmountSchema.safeParse(refundAmount);
    const reasonResult = refundReasonSchema.safeParse(refundReason);
    const newErrors: { amount?: string; reason?: string } = {};
    if (!amountResult.success) newErrors.amount = amountResult.error.errors[0].message;
    if (!reasonResult.success) newErrors.reason = reasonResult.error.errors[0].message;
    if (!refundPaymentId) newErrors.reason = newErrors.reason || "Select a payment";
    setRefundErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (!amountResult.success || !reasonResult.success) return;
    if (!refundPaymentId) return;

    try {
      await refundPayment(refundPaymentId, { amount: amountResult.data, method: refundMethod, reason: reasonResult.data });
      toast.success(isArabic ? "تم استرداد المبلغ" : "Refund processed");
      setRefundMode(false);
      setRefundPaymentId("");
      setRefundMethod("other");
      setRefundAmount("");
      setRefundReason("");
      setRefundErrors({});
      if (selectedOrder) loadOrderPayments(selectedOrder.id);
      loadOrders();
    } catch (err: any) {
      toast.error(err?.message || (isArabic ? "فشل الاسترداد" : "Refund failed"));
    }
  };

  const loadOrderPayments = async (orderId: string) => {
    try {
      const payments = await getOrderPayments(orderId);
      setOrderPayments(payments);
    } catch {
      setOrderPayments([]);
    }
  };

  const handleDiscount = async () => {
    if (!selectedOrder) return;
    const amountResult = discountAmountSchema.safeParse(discountAmount);
    const reasonResult = discountReasonSchema.safeParse(discountReason);
    const newErrors: { amount?: string; reason?: string } = {};
    if (!amountResult.success) newErrors.amount = amountResult.error.errors[0].message;
    if (!reasonResult.success) newErrors.reason = reasonResult.error.errors[0].message;
    setDiscountErrors(newErrors);
    if (!amountResult.success || !reasonResult.success) return;

    if (amountResult.data > selectedOrder.itemsTotal) {
      setDiscountErrors({ amount: isArabic ? "الخصم أكبر من إجمالي الأصناف" : "Discount exceeds items total" });
      return;
    }

    try {
      const updated = await applyDiscount(selectedOrder.id, { amount: amountResult.data, reason: reasonResult.data });
      toast.success(isArabic ? "تم تطبيق الخصم" : "Discount applied");
      setSelectedOrder({ ...selectedOrder, discountAmount: updated.discountAmount, total: updated.total } as Order);
      setDiscountMode(false);
      setDiscountAmount("");
      setDiscountReason("");
      setDiscountErrors({});
      loadOrders();
    } catch (err: any) {
      toast.error(err?.message || (isArabic ? "فشل تطبيق الخصم" : "Discount failed"));
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      loadOrderPayments(selectedOrder.id);
    } else {
      setOrderPayments([]);
    }
  }, [selectedOrder]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const o = await getOrders();
      setOrders([...o].reverse());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (typeFilter !== "all" && o.orderType !== typeFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg mb-4">{t.error}</p>
        <Button onClick={loadOrders}>{t.retry}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.orderHistory}</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue>{t.admin.orders.filterByStatus}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.orders.allStatuses}</SelectItem>
            <SelectItem value="received">{ORDER_STATUS_LABELS.received[language]}</SelectItem>
            <SelectItem value="preparing">{ORDER_STATUS_LABELS.preparing[language]}</SelectItem>
            <SelectItem value="ready">{ORDER_STATUS_LABELS.ready[language]}</SelectItem>
            <SelectItem value="completed">{ORDER_STATUS_LABELS.completed[language]}</SelectItem>
            <SelectItem value="cancelled">{ORDER_STATUS_LABELS.cancelled[language]}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue>{t.admin.orders.filterByType}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.orders.allTypes}</SelectItem>
            <SelectItem value="dine_in">{ORDER_TYPE_LABELS.dine_in[language]}</SelectItem>
            <SelectItem value="takeaway">{ORDER_TYPE_LABELS.takeaway[language]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t.admin.orders.noOrders}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-hover hover:-translate-y-px transition-all duration-200"
              onClick={() => setSelectedOrder(order)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedOrder(order); } }}
              tabIndex={0}
              role="button"
              aria-label={`${isArabic ? "عرض تفاصيل الطلب" : "View order"} #${order.orderNumber}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">#{order.orderNumber}</span>
                    <Badge className={STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status][language]}</Badge>
                    <Badge variant="outline">{ORDER_TYPE_LABELS[order.orderType][language]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.customerName} · {timeAgo(order.createdAt, language)}
                    {order.tableNumber && ` · ${t.kitchen.table} ${order.tableNumber}`}
                  </p>
                </div>
                <span className="font-bold text-sm shrink-0">
                  {formatPrice(orderTotal(order), language)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{t.admin.orders.orderDetails} #{selectedOrder.orderNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{t.checkout.customerName}:</span> {selectedOrder.customerName}</div>
                  <div><span className="text-muted-foreground">{t.admin.orders.filterByType}:</span> {ORDER_TYPE_LABELS[selectedOrder.orderType][language]}</div>
                  {selectedOrder.tableNumber && <div><span className="text-muted-foreground">{t.kitchen.table}:</span> {selectedOrder.tableNumber}</div>}
                  <div><span className="text-muted-foreground">{t.kitchen.time}:</span> {formatDate(selectedOrder.createdAt, language)}</div>
                </div>
                {selectedOrder.notes && <p className="text-sm text-muted-foreground italic">"{selectedOrder.notes}"</p>}
                {selectedOrder.status === "cancelled" && selectedOrder.cancelReason && (
                  <p className="text-sm text-destructive">
                    {isArabic ? "سبب الإلغاء" : "Cancellation reason"}: {selectedOrder.cancelReason}
                  </p>
                )}
                <Separator />
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{isArabic ? item.nameAr : item.nameEn} × {item.quantity}</span>
                      <span className="font-semibold">{formatPrice(item.unitPrice * item.quantity, language)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "الإجمالي قبل الخصم" : "Subtotal"}</span>
                    <span>{formatPrice(itemsSubtotal(selectedOrder), language)}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "الخصم" : "Discount"}</span>
                      <span>− {formatPrice(selectedOrder.discountAmount, language)}</span>
                    </div>
                  )}
                  {selectedOrder.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "الضريبة" : "Tax"}</span>
                      <span>{formatPrice(selectedOrder.taxAmount, language)}</span>
                    </div>
                  )}
                  {selectedOrder.serviceAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "الخدمة" : "Service"}</span>
                      <span>{formatPrice(selectedOrder.serviceAmount, language)}</span>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>{t.orderStatus.total}</span>
                  <span>{formatPrice(orderTotal(selectedOrder), language)}</span>
                </div>

                {/* Cancel flow */}
                {(selectedOrder.status === "received" || selectedOrder.status === "preparing") && (
                  cancelMode ? (
                    <div className="space-y-2">
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => { setCancelReason(e.target.value); setCancelError(""); }}
                        placeholder={isArabic ? "سبب إلغاء الطلب..." : "Reason for cancelling..."}
                        rows={2}
                        maxLength={280}
                        aria-invalid={!!cancelError}
                        aria-describedby={cancelError ? "cancel-reason-error" : undefined}
                      />
                      {cancelError && <p id="cancel-reason-error" className="text-xs text-destructive">{cancelError}</p>}
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setCancelMode(false); setCancelReason(""); setCancelError(""); }}>
                          {t.cancel}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!cancelReason.trim() || cancelOrderMutation.isPending}
                          onClick={handleCancelOrder}
                        >
                          {isArabic ? "تأكيد الإلغاء" : "Confirm cancellation"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button variant="destructive" size="sm" onClick={() => setCancelMode(true)}>
                        {ORDER_STATUS_LABELS.cancelled[language]}
                      </Button>
                    </div>
                  )
                )}

                {/* Refund flow */}
                {selectedOrder.paidTotal > 0 && !refundMode && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setRefundMode(true)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isArabic ? "استرداد" : "Refund"}
                    </Button>
                  </div>
                )}

                {refundMode && (
                  <div className="space-y-3 border border-orange-200 rounded-lg p-3 bg-orange-50/50 dark:bg-orange-950/30 dark:border-orange-800">
                    <Label className="text-sm font-medium">{isArabic ? "استرداد مبلغ" : "Refund Payment"}</Label>
                    {orderPayments.length > 0 ? (
                      <div className="space-y-2">
                        <Select value={refundPaymentId} onValueChange={setRefundPaymentId}>
                          <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الدفعة" : "Select payment"} /></SelectTrigger>
                          <SelectContent>
                            {orderPayments.filter((p) => p.amount > 0).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.method} — {formatPrice(p.amount, language)} ({formatDate(p.paidAt, language)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={refundMethod} onValueChange={(value) => setRefundMethod(value as typeof refundMethod)}>
                          <SelectTrigger><SelectValue placeholder={isArabic ? "طريقة رد المبلغ" : "Refund method"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">{isArabic ? "نقدي" : "Cash"}</SelectItem>
                            <SelectItem value="card">{isArabic ? "بطاقة" : "Card"}</SelectItem>
                            <SelectItem value="wallet">{isArabic ? "محفظة" : "Wallet"}</SelectItem>
                            <SelectItem value="other">{isArabic ? "أخرى" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => { setRefundAmount(e.target.value); setRefundErrors((p) => ({ ...p, amount: undefined })); }}
                          placeholder={isArabic ? "مبلغ الاسترداد" : "Refund amount"}
                          min={0.01}
                          step="0.01"
                          maxLength={280}
                          aria-invalid={!!refundErrors.amount}
                          aria-describedby={refundErrors.amount ? "refund-amount-error" : undefined}
                        />
                        {refundErrors.amount && <p id="refund-amount-error" className="text-xs text-destructive">{refundErrors.amount}</p>}
                        <Textarea
                          value={refundReason}
                          onChange={(e) => { setRefundReason(e.target.value); setRefundErrors((p) => ({ ...p, reason: undefined })); }}
                          placeholder={isArabic ? "سبب الاسترداد..." : "Reason for refund..."}
                          rows={2}
                          maxLength={280}
                          aria-invalid={!!refundErrors.reason}
                          aria-describedby={refundErrors.reason ? "refund-reason-error" : undefined}
                        />
                        {refundErrors.reason && <p id="refund-reason-error" className="text-xs text-destructive">{refundErrors.reason}</p>}
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setRefundMode(false); setRefundPaymentId(""); setRefundAmount(""); setRefundReason(""); setRefundErrors({}); }}>
                            {t.cancel}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!refundPaymentId || !refundAmount || !refundReason.trim()}
                            onClick={handleRefund}
                          >
                            {isArabic ? "تأكيد الاسترداد" : "Confirm Refund"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد دفعات" : "No payments found"}</p>
                    )}
                  </div>
                )}

                {/* Discount flow */}
                {selectedOrder.paidTotal === 0 && selectedOrder.status !== "cancelled" && selectedOrder.status !== "completed" && !discountMode && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setDiscountMode(true)}>
                      {isArabic ? "خصم" : "Discount"}
                    </Button>
                  </div>
                )}

                {discountMode && (
                  <div className="space-y-3 border border-blue-200 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-800">
                    <Label className="text-sm font-medium">{isArabic ? "تطبيق خصم" : "Apply Discount"}</Label>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        value={discountAmount}
                        onChange={(e) => { setDiscountAmount(e.target.value); setDiscountErrors((p) => ({ ...p, amount: undefined })); }}
                        placeholder={isArabic ? "مبلغ الخصم" : "Discount amount"}
                        min={0.01}
                        max={selectedOrder.itemsTotal}
                        step="0.01"
                        aria-invalid={!!discountErrors.amount}
                        aria-describedby={discountErrors.amount ? "discount-amount-error" : undefined}
                      />
                      {discountErrors.amount && <p id="discount-amount-error" className="text-xs text-destructive">{discountErrors.amount}</p>}
                      <Textarea
                        value={discountReason}
                        onChange={(e) => { setDiscountReason(e.target.value); setDiscountErrors((p) => ({ ...p, reason: undefined })); }}
                        placeholder={isArabic ? "سبب الخصم..." : "Reason for discount..."}
                        rows={2}
                        maxLength={280}
                        aria-invalid={!!discountErrors.reason}
                        aria-describedby={discountErrors.reason ? "discount-reason-error" : undefined}
                      />
                      {discountErrors.reason && <p id="discount-reason-error" className="text-xs text-destructive">{discountErrors.reason}</p>}
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setDiscountMode(false); setDiscountAmount(""); setDiscountReason(""); setDiscountErrors({}); }}>
                          {t.cancel}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!discountAmount || !discountReason.trim()}
                          onClick={handleDiscount}
                        >
                          {isArabic ? "تأكيد الخصم" : "Confirm Discount"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
