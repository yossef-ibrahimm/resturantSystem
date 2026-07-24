import { create } from "zustand";
import type { OrderStatus } from "@/lib/types";

interface ActiveOrderState {
  orderNumber: string | null;
  status: OrderStatus | null;
  setOrder: (orderNumber: string, status: OrderStatus) => void;
  updateStatus: (status: OrderStatus) => void;
  clearOrder: () => void;
}

const STORAGE_KEY = "tastytable.activeOrder";

function load(): { orderNumber: string | null; status: OrderStatus | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { orderNumber: data.orderNumber ?? null, status: data.status ?? null };
    }
  } catch { /* ignore */ }
  return { orderNumber: null, status: null };
}

const initial = load();

export const useActiveOrderStore = create<ActiveOrderState>((set) => ({
  orderNumber: initial.orderNumber,
  status: initial.status,

  setOrder: (orderNumber, status) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderNumber, status }));
    set({ orderNumber, status });
  },

  updateStatus: (status) => {
    const current = load();
    if (current.orderNumber) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderNumber: current.orderNumber, status }));
    }
    set({ status });
  },

  clearOrder: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ orderNumber: null, status: null });
  },
}));
