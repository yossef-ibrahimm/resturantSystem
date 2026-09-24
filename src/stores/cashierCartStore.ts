import { create } from "zustand";
import type { CartItem, MenuItem, MenuItemVariant } from "@/lib/types";

interface CashierCartState {
  items: CartItem[];
  customerName: string;
  phone: string;
  orderType: "dine_in" | "takeaway";
  tableNumber: string;
  notes: string;
  addItem: (menuItem: MenuItem, variant?: MenuItemVariant, notes?: string) => void;
  removeItem: (menuItemId: string, variantId?: string) => void;
  updateQuantity: (menuItemId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  setCustomerName: (name: string) => void;
  setPhone: (phone: string) => void;
  setOrderType: (type: "dine_in" | "takeaway") => void;
  setTableNumber: (num: string) => void;
  setNotes: (notes: string) => void;
  total: number;
  itemCount: number;
}

function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const price = item.variant ? item.menuItem.price + item.variant.priceAdjust : item.menuItem.price;
    return sum + price * item.quantity;
  }, 0);
}

// Task 1: persist customer name + phone across orders so the cashier doesn't
// retype them for every customer. Cart items, table, notes stay transient
// (they belong to the in-progress order, not the customer).
const CUSTOMER_STORAGE_KEY = "cashier:lastCustomer";

function loadCustomer(): { customerName: string; phone: string } {
  if (typeof window === "undefined") return { customerName: "", phone: "" };
  try {
    const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return { customerName: "", phone: "" };
    const parsed = JSON.parse(raw);
    return {
      customerName: typeof parsed.customerName === "string" ? parsed.customerName : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { customerName: "", phone: "" };
  }
}

function saveCustomer(customerName: string, phone: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOMER_STORAGE_KEY,
      JSON.stringify({ customerName, phone })
    );
  } catch {
    // localStorage may be unavailable (private mode, quota); degrade silently
  }
}

const initialCustomer = loadCustomer();

export const useCashierCartStore = create<CashierCartState>((set, get) => ({
  items: [],
  customerName: initialCustomer.customerName,
  phone: initialCustomer.phone,
  orderType: "dine_in",
  tableNumber: "",
  notes: "",

  addItem: (menuItem, variant, notes) => {
    const items = get().items;
    const existingIndex = items.findIndex(
      (i) => i.menuItem.id === menuItem.id && i.variant?.id === variant?.id
    );

    let newItems: CartItem[];
    if (existingIndex >= 0) {
      newItems = items.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newItems = [...items, { menuItem, quantity: 1, variant, notes }];
    }

    set({ items: newItems, total: calcTotal(newItems), itemCount: newItems.reduce((s, i) => s + i.quantity, 0) });
  },

  removeItem: (menuItemId, variantId) => {
    const newItems = get().items.filter(
      (i) => !(i.menuItem.id === menuItemId && i.variant?.id === variantId)
    );
    set({ items: newItems, total: calcTotal(newItems), itemCount: newItems.reduce((s, i) => s + i.quantity, 0) });
  },

  updateQuantity: (menuItemId, quantity, variantId) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId, variantId);
      return;
    }
    const newItems = get().items.map((item) =>
      item.menuItem.id === menuItemId && item.variant?.id === variantId
        ? { ...item, quantity }
        : item
    );
    set({ items: newItems, total: calcTotal(newItems), itemCount: newItems.reduce((s, i) => s + i.quantity, 0) });
  },

  clearCart: () => {
    set({
      items: [],
      // Keep customerName + phone for the next order — the task explicitly asks
      // for cross-order pre-fill. Order-specific fields reset.
      customerName: get().customerName,
      phone: get().phone,
      orderType: "dine_in",
      tableNumber: "",
      notes: "",
      total: 0,
      itemCount: 0,
    });
  },

  setCustomerName: (customerName) => {
    saveCustomer(customerName, get().phone);
    set({ customerName });
  },
  setPhone: (phone) => {
    saveCustomer(get().customerName, phone);
    set({ phone });
  },
  setOrderType: (orderType) => set({ orderType }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setNotes: (notes) => set({ notes }),

  total: 0,
  itemCount: 0,
}));
