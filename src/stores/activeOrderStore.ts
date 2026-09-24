import { create } from "zustand";
import type { OrderStatus } from "@/lib/types";

interface ActiveOrderState {
  orderNumber: string | null;
  orderToken: string | null;
  status: OrderStatus | null;
  setOrder: (orderNumber: string, status: OrderStatus, orderToken?: string) => void;
  updateStatus: (status: OrderStatus) => void;
  clearOrder: () => void;
}

const STORAGE_KEY = "tastytable.activeOrder";

function load(): { orderNumber: string | null; orderToken: string | null; status: OrderStatus | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        orderNumber: data.orderNumber ?? null,
        orderToken: data.orderToken ?? null,
        status: data.status ?? null,
      };
    }
  } catch { /* ignore */ }
  return { orderNumber: null, orderToken: null, status: null };
}

const initial = load();

export const useActiveOrderStore = create<ActiveOrderState>((set) => ({
  orderNumber: initial.orderNumber,
  orderToken: initial.orderToken,
  status: initial.status,

  setOrder: (orderNumber, status, orderToken) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderNumber, orderToken, status }));
    set({ orderNumber, orderToken, status });
  },

  updateStatus: (status) => {
    const current = load();
    if (current.orderNumber) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderNumber: current.orderNumber, orderToken: current.orderToken, status }));
    }
    set({ status });
  },

  clearOrder: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ orderNumber: null, orderToken: null, status: null });
  },
}));
