export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  image: string;
  available: boolean;
  variants?: MenuItemVariant[];
}

export interface MenuItemVariant {
  id: string;
  nameAr: string;
  nameEn: string;
  priceAdjust: number;
}

export type OrderStatus = "received" | "preparing" | "ready" | "completed";
export type OrderType = "dine_in" | "takeaway";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type UserRole = "admin" | "kitchen_staff";

export interface OrderItem {
  id: string;
  menuItemId: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  phone?: string;
  orderType: OrderType;
  tableNumber?: number;
  notes?: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  variant?: MenuItemVariant;
  notes?: string;
}

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  topItems: { name: string; count: number }[];
  recentOrders: Order[];
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "received",
  "preparing",
  "ready",
  "completed",
];
