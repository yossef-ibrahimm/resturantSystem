import type { Order, PaymentStatus } from "./types";

/** Shared money epsilon for paidTotal / refund checks (BE-009). */
export const MONEY_EPSILON = 0.01;

/** Round to 2 decimal places (money display / comparisons). */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Server-computed order total. Never recompute from client item lines
 * (tax/service/discount live on the snapshot only).
 */
export function orderTotal(order: Pick<Order, "total">): number {
  return roundMoney(order.total ?? 0);
}

/**
 * Items subtotal for display. Prefer the server snapshot; fall back to
 * line sum only when the snapshot is missing/zero on legacy rows.
 */
export function itemsSubtotal(order: Pick<Order, "itemsTotal" | "items">): number {
  const snapshot = Number(order.itemsTotal);
  if (Number.isFinite(snapshot) && snapshot > 0) return roundMoney(snapshot);
  const sum = (order.items ?? []).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  return roundMoney(sum);
}

/** Remaining balance after paidTotal (floors at 0 for display). */
export function remainingBalance(order: Pick<Order, "total" | "paidTotal">): number {
  const rem = roundMoney(orderTotal(order) - Number(order.paidTotal ?? 0));
  return rem > 0 ? rem : 0;
}

export type PaymentStatusTone = "paid" | "partial" | "refunded" | "unpaid";

export function paymentStatusTone(status: PaymentStatus | string): PaymentStatusTone {
  switch (status) {
    case "paid":
      return "paid";
    case "partially_paid":
      return "partial";
    case "refunded":
      return "refunded";
    default:
      return "unpaid";
  }
}

export function paymentStatusLabel(
  status: PaymentStatus | string,
  isArabic: boolean
): string {
  switch (paymentStatusTone(status)) {
    case "paid":
      return isArabic ? "مدفوع" : "Paid";
    case "partial":
      return isArabic ? "مدفوع جزئياً" : "Partially Paid";
    case "refunded":
      return isArabic ? "مسترد" : "Refunded";
    default:
      return isArabic ? "غير مدفوع" : "Unpaid";
  }
}

/** Tailwind classes for the payment badge (exhaustive over PaymentStatus). */
export function paymentStatusBadgeClass(status: PaymentStatus | string): string {
  switch (paymentStatusTone(status)) {
    case "paid":
      return "border-status-completed-border text-status-completed-fg bg-status-completed";
    case "partial":
      return "border-amber-400/60 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950";
    case "refunded":
      return "border-destructive/40 text-destructive";
    default:
      return "text-muted-foreground";
  }
}
