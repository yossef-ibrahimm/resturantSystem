import type { Category, DashboardStats, MenuItem, Order, User } from "./types";
import type {
  ReportSummary,
  RevenueOverTime,
  OrdersByStatus,
  TopItemsReport,
  PeakHoursReport,
  UnavailableItem,
} from "./report-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken(): string | null {
  try {
    return localStorage.getItem("tastytable.token");
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───

export async function login(email: string, password: string) {
  const data = await request<{ user: User; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("tastytable.token", data.token);
  return { user: data.user, token: data.token };
}

export function logout() {
  localStorage.removeItem("tastytable.token");
}

// ─── Categories ───

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export async function createCategory(data: {
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
}): Promise<Category> {
  return request<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<{ nameAr: string; nameEn: string; sortOrder: number }>
): Promise<Category> {
  return request<Category>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}

// ─── Menu Items ───

export async function getMenuItems(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/menu-items");
}

export async function getMenuItem(id: string): Promise<MenuItem> {
  return request<MenuItem>(`/menu-items/${id}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createMenuItem(data: Record<string, any>): Promise<MenuItem> {
  return request<MenuItem>("/menu-items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateMenuItem(id: string, data: Record<string, any>): Promise<MenuItem> {
  return request<MenuItem>(`/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  return request<void>(`/menu-items/${id}`, { method: "DELETE" });
}

// ─── Orders ───

export async function getOrders(): Promise<Order[]> {
  return request<Order[]>("/orders");
}

export async function getOrderById(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}`);
}

export async function getOrderByNumber(orderNumber: string): Promise<Order> {
  return request<Order>(`/orders/by-number/${orderNumber}`);
}

export async function createOrder(data: {
  customerName: string;
  phone?: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: number;
  notes?: string;
  items: {
    menuItemId: string;
    nameAr: string;
    nameEn: string;
    quantity: number;
    unitPrice: number;
    variant?: string;
    notes?: string;
  }[];
}): Promise<Order> {
  return request<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(
  id: string,
  status: string
): Promise<Order> {
  return request<Order>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function requestBill(orderNumber: string): Promise<Order> {
  return request<Order>(`/orders/by-number/${orderNumber}/request-bill`, {
    method: "PATCH",
  });
}

export async function acknowledgeBill(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/acknowledge-bill`, {
    method: "PATCH",
  });
}

// ─── Users ───

export async function getUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

export async function createUser(data: {
  email: string;
  name: string;
  role: string;
  password?: string;
}): Promise<User> {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleUserActive(id: string): Promise<User> {
  return request<User>(`/users/${id}/toggle-active`, { method: "PATCH" });
}

export async function deleteUser(id: string): Promise<void> {
  return request<void>(`/users/${id}`, { method: "DELETE" });
}

// ─── Dashboard ───

export async function getDashboardStats(): Promise<{
  todayOrders: number;
  todayRevenue: number;
  topItems: { name: string; count: number }[];
  recentOrders: Order[];
}> {
  return request<DashboardStats>("/dashboard/stats");
}

// ─── Image Upload ───

export async function uploadImage(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

// ─── Reports ───

function buildQueryString(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function getReportSummary(from?: string, to?: string): Promise<ReportSummary> {
  return request<ReportSummary>(`/reports/summary${buildQueryString(from, to)}`);
}

export async function getReportRevenue(from?: string, to?: string): Promise<RevenueOverTime> {
  return request<RevenueOverTime>(`/reports/revenue${buildQueryString(from, to)}`);
}

export async function getReportOrdersByStatus(from?: string, to?: string): Promise<OrdersByStatus> {
  return request<OrdersByStatus>(`/reports/orders-by-status${buildQueryString(from, to)}`);
}

export async function getReportTopItems(from?: string, to?: string): Promise<TopItemsReport> {
  return request<TopItemsReport>(`/reports/top-items${buildQueryString(from, to)}`);
}

export async function getReportPeakHours(from?: string, to?: string): Promise<PeakHoursReport> {
  return request<PeakHoursReport>(`/reports/peak-hours${buildQueryString(from, to)}`);
}

export async function getReportUnavailableItems(): Promise<UnavailableItem[]> {
  return request<UnavailableItem[]>("/reports/unavailable-items");
}