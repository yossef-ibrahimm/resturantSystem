import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import { useProcessPayment } from "@/hooks/useCashierOrders";
import { useSettingsQuery } from "@/hooks/useSettings";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Banknote, CreditCard, Wallet, CircleDot, Trash2, Printer, AlertTriangle, Link } from "lucide-react";
import type { Order, MergedGroup } from "@/lib/types";
import {
  openReceiptPrint,
  type ReceiptPaymentLine,
} from "./cashierReceipt";

interface PaymentRow {
  method: "cash" | "card" | "wallet" | "other";
  amount: number;
  tendered?: number;
  orderId: string; // which order this payment targets
}

interface CashierPaymentDialogProps {
  order: Order | null;
  mergedGroup?: (MergedGroup & { liveOrders: Order[]; combinedTotal: number; combinedPaid: number; combinedRemaining: number }) | null;
  onClose: () => void;
  hasOpenShift: boolean;
}

const METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Wallet,
  other: CircleDot,
};

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "كاش", en: "Cash" },
  card: { ar: "كارت", en: "Card" },
  wallet: { ar: "محفظة", en: "Wallet" },
  other: { ar: "أخرى", en: "Other" },
};

const PAYMENT_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export default function CashierPaymentDialog({ order, mergedGroup, onClose, hasOpenShift }: CashierPaymentDialogProps) {
  const { t, language, isArabic } = useLanguage();
  const processPayment = useProcessPayment();
  const { data: settings } = useSettingsQuery();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [method, setMethod] = useState<"cash" | "card" | "wallet" | "other">("cash");
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    order: Order;
    paymentLines: ReceiptPaymentLine[];
    amountPaidThisSession: number;
    change: number;
    partial: boolean;
  } | null>(null);

  // For merged group payment success
  const [completedMerged, setCompletedMerged] = useState<{
    orders: Order[];
    label: string;
    paymentLines: ReceiptPaymentLine[];
    amountPaidThisSession: number;
    change: number;
    partial: boolean;
  } | null>(null);

  const closedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    if (order || mergedGroup) {
      closedRef.current = false;
      setPayments([]);
      setMethod("cash");
      setTendered("");
      setSubmitting(false);
      setCompletedOrder(null);
      setCompletedMerged(null);
    } else {
      closedRef.current = true;
    }
  }, [order, mergedGroup]);

  // Determine what we're paying
  const isMerged = !!mergedGroup;
  const targetOrders = isMerged ? mergedGroup.liveOrders : order ? [order] : [];
  const combinedTotal = isMerged ? mergedGroup.combinedTotal : order?.total ?? 0;
  const combinedPaid = isMerged ? mergedGroup.combinedPaid : order?.paidTotal ?? 0;

  const remaining = useMemo(() => {
    return Math.max(0, combinedTotal - combinedPaid);
  }, [combinedTotal, combinedPaid]);

  const pendingTotal = payments.reduce((s, p) => s + p.amount, 0);
  const stillRemaining = Math.max(0, remaining - pendingTotal);

  const change = method === "cash" && tendered
    ? Math.max(0, Number(tendered) - stillRemaining)
    : 0;

  const paymentAmount = method === "cash"
    ? Math.min(Number(tendered) || 0, stillRemaining)
    : stillRemaining;

  const addPayment = () => {
    if (stillRemaining <= 0) {
      toast.error(language === "ar" ? "تم الدفع بالفعل" : "Already fully paid");
      return;
    }
    if (method === "cash" && !hasOpenShift) {
      toast.error(language === "ar" ? "افتح وردية أولاً" : "Open a cash shift first");
      return;
    }

    let amount: number;
    if (method === "cash") {
      const tenderedNum = Number(tendered);
      if (!tenderedNum || tenderedNum <= 0) {
        toast.error(language === "ar" ? "أدخل مبلغ صحيح" : "Enter a valid amount");
        return;
      }
      amount = Math.min(tenderedNum, stillRemaining);
    } else {
      amount = stillRemaining;
    }

    setPayments([...payments, { method, amount, tendered: method === "cash" ? Number(tendered) : undefined, orderId: "" }]);
    setTendered("");
  };

  const removePayment = (idx: number) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const confirmPayment = async () => {
    if (targetOrders.length === 0) return;
    if (payments.length === 0) {
      toast.error(language === "ar" ? "أضف دفعة واحدة على الأقل" : "Add at least one payment");
      return;
    }

    const hasCash = payments.some((p) => p.method === "cash");
    if (hasCash && !hasOpenShift) {
      toast.error(language === "ar" ? "افتح وردية أولاً" : "Open a cash shift first");
      return;
    }

    if (submittingRef.current) return;

    setSubmitting(true);
    submittingRef.current = true;

    // For merged groups: distribute payments across orders
    // For single order: same as before
    const succeeded: { index: number; payment: PaymentRow }[] = [];
    const failed: { index: number; error: string }[] = [];
    const latestOrders: Order[] = [...targetOrders];
    let cashTendered = 0;

    try {
      if (isMerged) {
        // Merged: distribute payments sequentially across orders
        // Track remaining amount per payment row as it gets consumed
        let paymentIdx = 0;
        let paymentRemaining = payments.length > 0 ? payments[0].amount : 0;
        const countedTendered = new Set<number>(); // only count each payment row's tendered once
        for (let oi = 0; oi < targetOrders.length; oi++) {
          if (closedRef.current) return;
          const o = targetOrders[oi];
          const oRemaining = Math.max(0, o.total - o.paidTotal);
          if (oRemaining <= 0) continue;

          let assigned = 0;
          while (assigned < oRemaining && paymentIdx < payments.length) {
            const p = payments[paymentIdx];
            const toPay = Math.min(paymentRemaining, oRemaining - assigned);
            if (toPay <= 0) break;

            const idempotencyKey = `pay-merged-${o.id}-${Date.now()}-${oi}-${Math.random().toString(36).slice(2, 8)}`;
            try {
              const res = await withTimeout(
                processPayment.mutateAsync({
                  orderId: o.id,
                  amount: toPay,
                  method: p.method,
                  idempotencyKey,
                }),
                PAYMENT_TIMEOUT_MS,
                language === "ar" ? "الدفعة" : "Payment"
              );
              succeeded.push({ index: paymentIdx, payment: { ...p, amount: toPay } });
              if (p.method === "cash" && p.tendered && !countedTendered.has(paymentIdx)) {
                cashTendered += p.tendered;
                countedTendered.add(paymentIdx);
              }
              if (res?.order) {
                latestOrders[oi] = res.order;
              }
            } catch (err: any) {
              failed.push({ index: paymentIdx, error: err?.message || "Failed" });
            }

            assigned += toPay;
            paymentRemaining -= toPay;
            if (paymentRemaining <= 0) {
              paymentIdx++;
              paymentRemaining = paymentIdx < payments.length ? payments[paymentIdx].amount : 0;
            }
          }
        }
      } else {
        // Single order: original logic
        for (let i = 0; i < payments.length; i++) {
          if (closedRef.current) return;
          const p = payments[i];
          const idempotencyKey = `pay-${order!.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
          try {
            const res = await withTimeout(
              processPayment.mutateAsync({
                orderId: order!.id,
                amount: p.amount,
                method: p.method,
                idempotencyKey,
              }),
              PAYMENT_TIMEOUT_MS,
              language === "ar" ? "الدفعة" : "Payment"
            );
            succeeded.push({ index: i, payment: p });
            if (p.method === "cash" && p.tendered) {
              cashTendered += p.tendered;
            }
            if (res?.order) {
              latestOrders[0] = res.order;
            }
          } catch (err: any) {
            failed.push({ index: i, error: err?.message || "Failed" });
          }
        }
      }

      if (closedRef.current) return;

      const succeededTotal = succeeded.reduce((s, x) => s + x.payment.amount, 0);
      const allSucceeded = failed.length === 0;
      const anySucceeded = succeeded.length > 0;

      // Compute final paid/total across all target orders
      const finalPaid = latestOrders.reduce((s, o) => s + o.paidTotal, 0);
      const finalTotal = latestOrders.reduce((s, o) => s + o.total, 0);
      const fullyPaid = allSucceeded && finalPaid + 0.01 >= finalTotal;
      const changeDue = fullyPaid && cashTendered > 0
        ? Math.max(0, cashTendered - succeededTotal)
        : 0;

      if (allSucceeded) {
        toast.success(
          fullyPaid
            ? (language === "ar" ? "تم الدفع بنجاح" : "Payment processed")
            : (language === "ar" ? "تم تسجيل الدفع" : "Payment recorded")
        );
        const paymentLines: ReceiptPaymentLine[] = succeeded.map((s) => ({
          method: s.payment.method,
          amount: s.payment.amount,
          tendered: s.payment.tendered,
        }));

        if (isMerged) {
          setCompletedMerged({
            orders: latestOrders,
            label: mergedGroup!.label || (isArabic ? "طلب مدمج" : "Merged Order"),
            paymentLines,
            amountPaidThisSession: succeededTotal,
            change: changeDue,
            partial: !fullyPaid,
          });
        } else {
          setCompletedOrder({
            order: latestOrders[0],
            paymentLines,
            amountPaidThisSession: succeededTotal,
            change: changeDue,
            partial: !fullyPaid,
          });
        }
        setPayments([]);
      } else if (anySucceeded) {
        toast.warning(
          language === "ar"
            ? `تم ${succeeded.length} من ${payments.length} دفعات. فشل ${failed.length}`
            : `${succeeded.length} of ${payments.length} payments succeeded. ${failed.length} failed`
        );
        setPayments(payments.filter((_, i) => failed.some((f) => f.index === i)));
      } else {
        toast.error(language === "ar" ? "فشل جميع الدفعات" : "All payments failed");
      }
    } catch (err: any) {
      toast.error(err?.message || (language === "ar" ? "حدث خطأ غير متوقع" : "Unexpected error"));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = useCallback(() => {
    if (completedOrder) {
      const ok = openReceiptPrint({
        order: completedOrder.order,
        settings: settings ?? null,
        payments: completedOrder.paymentLines,
        amountPaid: completedOrder.amountPaidThisSession,
        change: completedOrder.change,
        language: (language === "ar" ? "ar" : "en") as "ar" | "en",
      });
      if (!ok) toast.error(t.cashier.receiptPopupBlocked);
    } else if (completedMerged) {
      // Print receipt for each order in the merged group
      for (const o of completedMerged.orders) {
        openReceiptPrint({
          order: o,
          settings: settings ?? null,
          payments: completedMerged.paymentLines,
          amountPaid: o.paidTotal,
          change: 0,
          language: (language === "ar" ? "ar" : "en") as "ar" | "en",
        });
      }
    }
  }, [completedOrder, completedMerged, settings, language, t]);

  const handleClose = useCallback(() => {
    if (submittingRef.current) {
      toast.error(language === "ar" ? "انتظر اكتمال الدفع" : "Wait for payment to finish");
      return;
    }
    setCompletedOrder(null);
    setCompletedMerged(null);
    onClose();
  }, [onClose, language]);

  if (!order && !mergedGroup) return null;

  // ── Success view for merged group ─────────────────────────────────────
  if (completedMerged) {
    return (
      <Dialog open onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              {completedMerged.label}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "ar" ? "طباعة الفاتورة" : "Print receipt"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {completedMerged.partial ? (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">{t.cashier.receiptPartial}</div>
                  <div className="mt-1 text-xs">
                    {language === "ar" ? "المتبقي" : "Remaining"}:{" "}
                    {formatPrice(Math.max(0, completedMerged.orders.reduce((s, o) => s + o.total, 0) - completedMerged.orders.reduce((s, o) => s + o.paidTotal, 0)), language)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                {t.cashier.paid}
              </div>
            )}

            {/* Per-order summary */}
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              {completedMerged.orders.map((o) => (
                <div key={o.id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    #{o.orderNumber}
                    {o.tableNumber && ` — ${isArabic ? "طاولة" : "Table"} ${o.tableNumber}`}
                  </span>
                  <span>{formatPrice(o.total, language)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isArabic ? "الإجمالي" : "Total"}</span>
                <span className="font-bold">{formatPrice(completedMerged.orders.reduce((s, o) => s + o.total, 0), language)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isArabic ? "المدفوع الآن" : "Paid Now"}</span>
                <span>{formatPrice(completedMerged.amountPaidThisSession, language)}</span>
              </div>
              {completedMerged.change > 0 && (
                <div className="flex justify-between font-bold text-green-700 dark:text-green-400">
                  <span>{t.cashier.change}</span>
                  <span>{formatPrice(completedMerged.change, language)}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>{t.cashier.close}</Button>
            <Button onClick={handlePrintReceipt}>
              <Printer className="h-4 w-4 me-1" />
              {t.cashier.printReceipt}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Success view for single order ─────────────────────────────────────
  if (completedOrder) {
    return (
      <Dialog open onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              {t.cashier.receiptTitle} — #{completedOrder.order.orderNumber}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "ar" ? "طباعة الفاتورة" : "Print receipt"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {completedOrder.partial ? (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">{t.cashier.receiptPartial}</div>
                  <div className="mt-1 text-xs">
                    {language === "ar" ? "المتبقي" : "Remaining"}:{" "}
                    {formatPrice(Math.max(0, completedOrder.order.total - completedOrder.order.paidTotal), language)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                {t.cashier.paid}
              </div>
            )}

            <div className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.cashier.receiptTotal}</span>
                <span className="font-bold">{formatPrice(completedOrder.order.total, language)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.cashier.receiptPaid}</span>
                <span>{formatPrice(completedOrder.amountPaidThisSession, language)}</span>
              </div>
              {completedOrder.change > 0 && (
                <div className="flex justify-between font-bold text-green-700 dark:text-green-400">
                  <span>{t.cashier.change}</span>
                  <span>{formatPrice(completedOrder.change, language)}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>{t.cashier.close}</Button>
            <Button onClick={handlePrintReceipt}>
              <Printer className="h-4 w-4 me-1" />
              {t.cashier.printReceipt}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Active payment view ────────────────────────────────────────────────
  const displayLabel = isMerged
    ? (mergedGroup.label || (isArabic ? "طلب مدمج" : "Merged Order"))
    : `#${order!.orderNumber}`;

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMerged && <Link className="h-4 w-4" />}
            {language === "ar" ? "دفع" : "Pay"} — {displayLabel}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "ar" ? "دفع مبلغ للطلب" : "Pay amount for this order"}
          </DialogDescription>
        </DialogHeader>

        {/* No-shift warning */}
        {!hasOpenShift && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            {isArabic
              ? "لا توجد وردية مفتوحة — افتح وردية أولاً من الشريط العلوي"
              : "No cash shift open — open a shift from the top bar first"}
          </div>
        )}

        {/* Order summary */}
        <ScrollArea className="flex-1 min-h-0 max-h-60">
          <div className="space-y-2 text-sm pr-2">
            {isMerged ? (
              // Merged: show each order
              mergedGroup.liveOrders.map((o) => (
                <div key={o.id} className="flex justify-between rounded-lg border p-2">
                  <div>
                    <span className="font-medium">#{o.orderNumber}</span>
                    <span className="text-muted-foreground ms-2 text-xs">
                      {o.customerName}
                      {o.tableNumber && ` — ${isArabic ? "طاولة" : "Table"} ${o.tableNumber}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <div>{formatPrice(o.total, language)}</div>
                    {o.paidTotal > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {isArabic ? "المتبقي" : "Rem"}: {formatPrice(o.total - o.paidTotal, language)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              // Single order
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isArabic ? "الزبون" : "Customer"}</span>
                <span>{order!.customerName}</span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isArabic ? "الإجمالي" : "Total"}</span>
              <span className="font-bold">{formatPrice(combinedTotal, language)}</span>
            </div>
            {combinedPaid > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isArabic ? "المدفوع" : "Paid"}</span>
                <span>{formatPrice(combinedPaid, language)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-primary">
              <span>{isArabic ? "المتبقي" : "Remaining"}</span>
              <span>{formatPrice(remaining, language)}</span>
            </div>
          </div>
        </ScrollArea>

        {/* Pending payments */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">{isArabic ? "الدفعات المضافة" : "Added Payments"}</Label>
            {payments.map((p, idx) => {
              const Icon = METHOD_ICONS[p.method];
              return (
                <div key={idx} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{METHOD_LABELS[p.method]?.[language] || p.method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatPrice(p.amount, language)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removePayment(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>{isArabic ? "مجموع الدفعات" : "Payments Total"}</span>
              <span>{formatPrice(pendingTotal, language)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-orange-600">
              <span>{isArabic ? "المتبقي" : "Still Remaining"}</span>
              <span>{formatPrice(stillRemaining, language)}</span>
            </div>
          </div>
        )}

        {/* Add payment form */}
        <div className="space-y-3 border-t pt-3">
          <Label className="text-xs">{isArabic ? "إضافة دفعة" : "Add Payment"}</Label>
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as any)}
            className="flex gap-2"
          >
            {(["cash", "card", "wallet", "other"] as const).map((m) => {
              const Icon = METHOD_ICONS[m];
              return (
                <label
                  key={m}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    method === m ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value={m} className="sr-only" />
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{METHOD_LABELS[m]?.[language] || m}</span>
                </label>
              );
            })}
          </RadioGroup>

          <div className="rounded-lg bg-muted/50 border p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{isArabic ? "المبلغ" : "Amount"}</p>
            <p className="text-xl font-bold tabular-nums">
              {method === "cash" && Number(tendered) > 0
                ? formatPrice(paymentAmount, language)
                : formatPrice(stillRemaining, language)}
            </p>
          </div>

          {method === "cash" && (
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "المبلغ المدفوع" : "Amount Tendered"}</Label>
              <Input
                type="number"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
              />
            </div>
          )}

          {method === "cash" && change > 0 && (
            <div className="rounded-lg bg-green-50 p-2 text-center text-sm font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
              {isArabic ? "العلّة" : "Change"}: {formatPrice(change, language)}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            disabled={stillRemaining <= 0 || submitting || (method === "cash" && (!tendered || Number(tendered) <= 0))}
            onClick={addPayment}
          >
            {isArabic ? "إضافة دفعة" : "Add Payment"}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button
            disabled={payments.length === 0 || submitting || (method === "cash" && !hasOpenShift)}
            onClick={confirmPayment}
          >
            {submitting ? t.loading : t.cashier.confirmPayment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
