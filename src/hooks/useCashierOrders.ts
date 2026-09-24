import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getOrders, createOrder, createPayment } from "@/lib/api";
import { connectSocket, disconnectSocket, onSocketEvent } from "@/lib/socket";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import type { Order } from "@/lib/types";

/**
 * Returns all orders relevant to the cashier counter.
 * For the unpaid/partial list: filters on remaining > 0 (not just paymentStatus string).
 */
export function useCashierOrders() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const query = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    refetchInterval: 5_000,
  });
  const { refetch } = query;

  // WebSocket-driven invalidation
  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();
    const unsubNew = onSocketEvent("order:new", () => refetch());
    const unsubUpd = onSocketEvent("order:updated", () => refetch());
    return () => {
      unsubNew();
      unsubUpd();
      disconnectSocket();
    };
  }, [isAuthenticated, refetch]);

  return query;
}

/**
 * Filter helper: returns orders with remaining balance > 0.
 * Handles both fully unpaid and partially paid orders.
 * Includes completed orders that are still unpaid.
 */
export function getUnpaidOrders(orders: Order[]): Order[] {
  return orders.filter((o) => {
    if (o.status === "cancelled") return false;
    const remaining = o.total - o.paidTotal;
    return remaining > 0.01; // epsilon for floating-point safety
  });
}

/**
 * Filter helper: returns active orders for kitchen display (received/preparing/ready).
 */
export function getActiveOrders(orders: Order[]): Order[] {
  return orders.filter(
    (o) => o.status === "received" || o.status === "preparing" || o.status === "ready"
  );
}

export function useCreateCashierOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createOrder>[0]) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      amount,
      method,
      idempotencyKey,
      note,
    }: {
      orderId: string;
      amount: number;
      method: "cash" | "card" | "wallet" | "other";
      idempotencyKey: string;
      note?: string;
    }) => createPayment(orderId, { amount, method, idempotencyKey, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
