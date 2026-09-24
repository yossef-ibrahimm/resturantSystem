import { describe, it, expect } from "vitest";
import {
  MONEY_EPSILON,
  roundMoney,
  orderTotal,
  itemsSubtotal,
  remainingBalance,
  paymentStatusTone,
  paymentStatusLabel,
  paymentStatusBadgeClass,
} from "./money";
import type { Order } from "./types";

const baseOrder = {
  total: 114,
  itemsTotal: 100,
  paidTotal: 40,
  items: [
    { id: "1", menuItemId: "m", nameAr: "a", nameEn: "A", quantity: 2, unitPrice: 50 },
  ],
} as unknown as Order;

describe("money helpers", () => {
  it("roundMoney rounds to 2dp", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(NaN)).toBe(0);
    expect(roundMoney(1.234)).toBe(1.23);
  });

  it("orderTotal uses server total, not item sum", () => {
    expect(orderTotal(baseOrder)).toBe(114);
  });

  it("itemsSubtotal prefers snapshot", () => {
    expect(itemsSubtotal(baseOrder)).toBe(100);
  });

  it("itemsSubtotal falls back to line sum when snapshot missing", () => {
    const legacy = { ...baseOrder, itemsTotal: 0 } as Order;
    expect(itemsSubtotal(legacy)).toBe(100);
  });

  it("remainingBalance floors at 0", () => {
    expect(remainingBalance(baseOrder)).toBe(74);
    expect(remainingBalance({ total: 50, paidTotal: 60 } as Order)).toBe(0);
  });

  it("paymentStatusTone is exhaustive over PaymentStatus", () => {
    expect(paymentStatusTone("paid")).toBe("paid");
    expect(paymentStatusTone("partially_paid")).toBe("partial");
    expect(paymentStatusTone("refunded")).toBe("refunded");
    expect(paymentStatusTone("unpaid")).toBe("unpaid");
    expect(paymentStatusTone("unknown")).toBe("unpaid");
  });

  it("paymentStatusLabel AR/EN", () => {
    expect(paymentStatusLabel("partially_paid", true)).toBe("مدفوع جزئياً");
    expect(paymentStatusLabel("partially_paid", false)).toBe("Partially Paid");
    expect(paymentStatusLabel("paid", false)).toBe("Paid");
  });

  it("paymentStatusBadgeClass returns classes for every tone", () => {
    for (const s of ["paid", "partially_paid", "refunded", "unpaid"] as const) {
      expect(paymentStatusBadgeClass(s).length).toBeGreaterThan(0);
    }
  });

  it("MONEY_EPSILON is 0.01", () => {
    expect(MONEY_EPSILON).toBe(0.01);
  });
});
