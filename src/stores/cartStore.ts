import { create } from "zustand";
import type { CartItem, MenuItem, MenuItemVariant } from "@/lib/types";

interface CartState {
  items: CartItem[];
  addItem: (menuItem: MenuItem, variant?: MenuItemVariant, notes?: string) => void;
  removeItem: (menuItemId: string, variantId?: string) => void;
  updateQuantity: (menuItemId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const price = item.variant ? item.menuItem.price + item.variant.priceAdjust : item.menuItem.price;
    return sum + price * item.quantity;
  }, 0);
}

function loadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem("tastytable.cart");
    if (stored) return JSON.parse(stored);
  } catch { /* empty cart */ }
  return [];
}

function saveCart(items: CartItem[]) {
  localStorage.setItem("tastytable.cart", JSON.stringify(items));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadCart(),

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

    saveCart(newItems);
    set({ items: newItems, total: calcTotal(newItems), itemCount: newItems.reduce((s, i) => s + i.quantity, 0) });
  },

  removeItem: (menuItemId, variantId) => {
    const newItems = get().items.filter(
      (i) => !(i.menuItem.id === menuItemId && i.variant?.id === variantId)
    );
    saveCart(newItems);
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
    saveCart(newItems);
    set({ items: newItems, total: calcTotal(newItems), itemCount: newItems.reduce((s, i) => s + i.quantity, 0) });
  },

  clearCart: () => {
    localStorage.removeItem("tastytable.cart");
    set({ items: [], total: 0, itemCount: 0 });
  },

  total: calcTotal(loadCart()),
  itemCount: loadCart().reduce((s, i) => s + i.quantity, 0),
}));
