import {
  seedCategories,
  seedMenuItems,
  seedOrders,
  seedUsers,
} from "./mock-data";
import type { Category, MenuItem, Order, User } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─── Mock State (in-memory for GitHub Pages) ───

let useMock = false;
let mockCategories = [...seedCategories];
let mockMenuItems = [...seedMenuItems];
let mockOrders = [...seedOrders];
let mockUsers = [...seedUsers];
let mockOrderCounter = 1004;

function checkBackend() {
  if (useMock) return false;
  // Try to reach backend; if it fails, switch to mock
  return new Promise<boolean>((resolve) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort();
      useMock = true;
      resolve(false);
    }, 2000);
    fetch(`${API_BASE}/categories`, {
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => {
        clearTimeout(timer);
        if (r.ok) resolve(true);
        else {
          useMock = true;
          resolve(false);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        useMock = true;
        resolve(false);
      });
  });
}

// Check on load
checkBackend();

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
  if (useMock) throw new Error("Mock mode");
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

function generateId() {
  return "mock-" + Math.random().toString(36).slice(2, 11);
}

function delay(ms = 100) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Auth ───

export async function login(email: string, password: string) {
  if (useMock) {
    await delay(300);
    const user = mockUsers.find(
      (u) => u.email === email && u.active
    );
    if (!user || password !== "password123") {
      throw new Error("Invalid credentials");
    }
    const token = "mock-token-" + user.id;
    localStorage.setItem("tastytable.token", token);
    return { user, token };
  }

  try {
    const data = await request<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("tastytable.token", data.token);
    return { user: data.user, token: data.token };
  } catch (err) {
    useMock = true;
    return login(email, password);
  }
}

export function logout() {
  localStorage.removeItem("tastytable.token");
}

// ─── Categories ───

export async function getCategories(): Promise<Category[]> {
  if (useMock) {
    await delay(50);
    return [...mockCategories].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  try {
    return await request<Category[]>("/categories");
  } catch {
    useMock = true;
    return getCategories();
  }
}

export async function createCategory(data: {
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
}): Promise<Category> {
  if (useMock) {
    await delay(100);
    const cat: Category = {
      id: generateId(),
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      sortOrder: data.sortOrder ?? mockCategories.length + 1,
    };
    mockCategories.push(cat);
    return cat;
  }
  return request<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<{ nameAr: string; nameEn: string; sortOrder: number }>
): Promise<Category> {
  if (useMock) {
    await delay(100);
    const cat = mockCategories.find((c) => c.id === id);
    if (!cat) throw new Error("Not found");
    Object.assign(cat, data);
    return cat;
  }
  return request<Category>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  if (useMock) {
    await delay(100);
    mockCategories = mockCategories.filter((c) => c.id !== id);
    return;
  }
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}

// ─── Menu Items ───

export async function getMenuItems(): Promise<MenuItem[]> {
  if (useMock) {
    await delay(50);
    return [...mockMenuItems];
  }
  try {
    return await request<MenuItem[]>("/menu-items");
  } catch {
    useMock = true;
    return getMenuItems();
  }
}

export async function getMenuItem(id: string): Promise<MenuItem> {
  if (useMock) {
    await delay(50);
    const item = mockMenuItems.find((i) => i.id === id);
    if (!item) throw new Error("Not found");
    return item;
  }
  return request<MenuItem>(`/menu-items/${id}`);
}

export async function createMenuItem(data: any): Promise<MenuItem> {
  if (useMock) {
    await delay(100);
    const item: MenuItem = {
      id: generateId(),
      categoryId: data.categoryId,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      descriptionAr: data.descriptionAr || "",
      descriptionEn: data.descriptionEn || "",
      price: data.price,
      image: data.image || "",
      available: data.available ?? true,
    };
    mockMenuItems.push(item);
    return item;
  }
  return request<MenuItem>("/menu-items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(id: string, data: any): Promise<MenuItem> {
  if (useMock) {
    await delay(100);
    const item = mockMenuItems.find((i) => i.id === id);
    if (!item) throw new Error("Not found");
    Object.assign(item, data);
    return item;
  }
  return request<MenuItem>(`/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  if (useMock) {
    await delay(100);
    mockMenuItems = mockMenuItems.filter((i) => i.id !== id);
    return;
  }
  return request<void>(`/menu-items/${id}`, { method: "DELETE" });
}

// ─── Orders ───

export async function getOrders(): Promise<Order[]> {
  if (useMock) {
    await delay(50);
    return [...mockOrders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  try {
    return await request<Order[]>("/orders");
  } catch {
    useMock = true;
    return getOrders();
  }
}

export async function getOrderById(id: string): Promise<Order> {
  if (useMock) {
    await delay(50);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error("Not found");
    return order;
  }
  return request<Order>(`/orders/${id}`);
}

export async function getOrderByNumber(orderNumber: string): Promise<Order> {
  if (useMock) {
    await delay(50);
    const order = mockOrders.find((o) => o.orderNumber === orderNumber);
    if (!order) throw new Error("Not found");
    return order;
  }
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
  if (useMock) {
    await delay(200);
    const total = data.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0
    );
    const order: Order = {
      id: generateId(),
      orderNumber: String(mockOrderCounter++),
      customerName: data.customerName,
      phone: data.phone,
      orderType: data.orderType,
      tableNumber: data.tableNumber,
      notes: data.notes,
      items: data.items.map((i, idx) => ({
        id: `oi-${generateId()}`,
        ...i,
      })),
      status: "received",
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockOrders.unshift(order);
    return order;
  }
  return request<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(
  id: string,
  status: string
): Promise<Order> {
  if (useMock) {
    await delay(100);
    const order = mockOrders.find((o) => o.id === id);
    if (!order) throw new Error("Not found");
    order.status = status as any;
    order.updatedAt = new Date().toISOString();
    return order;
  }
  return request<Order>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Users ───

export async function getUsers(): Promise<User[]> {
  if (useMock) {
    await delay(50);
    return [...mockUsers];
  }
  try {
    return await request<User[]>("/users");
  } catch {
    useMock = true;
    return getUsers();
  }
}

export async function createUser(data: {
  email: string;
  name: string;
  role: string;
  password?: string;
}): Promise<User> {
  if (useMock) {
    await delay(100);
    const user: User = {
      id: generateId(),
      email: data.email,
      name: data.name,
      role: data.role as any,
      active: true,
    };
    mockUsers.push(user);
    return user;
  }
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleUserActive(id: string): Promise<User> {
  if (useMock) {
    await delay(100);
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new Error("Not found");
    user.active = !user.active;
    return user;
  }
  return request<User>(`/users/${id}/toggle-active`, { method: "PATCH" });
}

export async function deleteUser(id: string): Promise<void> {
  if (useMock) {
    await delay(100);
    mockUsers = mockUsers.filter((u) => u.id !== id);
    return;
  }
  return request<void>(`/users/${id}`, { method: "DELETE" });
}

// ─── Dashboard ───

export async function getDashboardStats(): Promise<{
  todayOrders: number;
  todayRevenue: number;
  topItems: { name: string; count: number }[];
  recentOrders: Order[];
}> {
  if (useMock) {
    await delay(100);
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = mockOrders.filter(
      (o) => o.createdAt.slice(0, 10) === today
    );
    const totalRevenue = mockOrders.reduce((sum, o) => {
      return (
        sum +
        o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      );
    }, 0);

    const itemCount: Record<string, number> = {};
    mockOrders.forEach((o) =>
      o.items.forEach((i) => {
        itemCount[i.nameEn] = (itemCount[i.nameEn] || 0) + i.quantity;
      })
    );
    const topItems = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      todayOrders: todayOrders.length || mockOrders.length,
      todayRevenue: totalRevenue,
      topItems,
      recentOrders: mockOrders.slice(0, 5),
    };
  }
  return request<any>("/dashboard/stats");
}

// ─── Image Upload ───

export async function uploadImage(file: File) {
  if (useMock) {
    await delay(300);
    return { url: URL.createObjectURL(file) };
  }
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

import type {
  ReportSummary,
  RevenueOverTime,
  OrdersByStatus,
  TopItemsReport,
  PeakHoursReport,
  UnavailableItem,
} from "./report-types";

function buildQueryString(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function mockDateRange(from?: string, to?: string) {
  const now = new Date();
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end };
}

function mockFilterOrders(start: Date, end: Date) {
  return mockOrders.filter((o) => {
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

export async function getReportSummary(from?: string, to?: string): Promise<ReportSummary> {
  if (useMock) {
    await delay(100);
    const { start, end } = mockDateRange(from, to);
    const prevMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - prevMs);
    const prevEnd = new Date(start.getTime() - 1);
    const curr = mockFilterOrders(start, end);
    const prev = mockFilterOrders(prevStart, prevEnd);
    const rev = (orders: Order[]) => orders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.unitPrice * i.quantity, 0), 0);
    const revenue = rev(curr);
    const prevRevenue = rev(prev);
    const orderCount = curr.length;
    const prevOrderCount = prev.length;
    const avgValue = orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0;
    const prevAvgValue = prevOrderCount > 0 ? Math.round((prevRevenue / prevOrderCount) * 100) / 100 : 0;
    const pct = (c: number, p: number): number | null => {
      if (p === 0) return c > 0 ? 100 : null;
      return Math.round(((c - p) / p) * 100 * 100) / 100;
    };
    return {
      revenue, revenueChange: pct(revenue, prevRevenue),
      orderCount, orderCountChange: pct(orderCount, prevOrderCount),
      avgValue, avgValueChange: pct(avgValue, prevAvgValue),
      dineIn: curr.filter((o) => o.orderType === "dine_in").length,
      takeaway: curr.filter((o) => o.orderType === "takeaway").length,
      range: { from: start.toISOString(), to: end.toISOString() },
    };
  }
  try {
    return await request<ReportSummary>(`/reports/summary${buildQueryString(from, to)}`);
  } catch {
    useMock = true;
    return getReportSummary(from, to);
  }
}

export async function getReportRevenue(from?: string, to?: string): Promise<RevenueOverTime> {
  if (useMock) {
    await delay(100);
    const { start, end } = mockDateRange(from, to);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const orders = mockFilterOrders(start, end).filter((o) => o.status !== "cancelled");

    if (diffDays <= 1.5) {
      const buckets: Record<number, { revenue: number; count: number }> = {};
      for (let h = 0; h < 24; h++) buckets[h] = { revenue: 0, count: 0 };
      for (const order of orders) {
        const hour = new Date(order.createdAt).getHours();
        buckets[hour].revenue += order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[hour].count += 1;
      }
      return {
        granularity: "hourly",
        data: Object.entries(buckets).map(([h, v]) => ({ label: `${String(h).padStart(2, "0")}:00`, revenue: Math.round(v.revenue * 100) / 100, orders: v.count })),
      };
    } else if (diffDays <= 60) {
      const buckets: Record<string, { revenue: number; count: number }> = {};
      for (const order of orders) {
        const day = order.createdAt.slice(0, 10);
        if (!buckets[day]) buckets[day] = { revenue: 0, count: 0 };
        buckets[day].revenue += order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[day].count += 1;
      }
      return {
        granularity: "daily",
        data: Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ label: d, revenue: Math.round(v.revenue * 100) / 100, orders: v.count })),
      };
    } else {
      const buckets: Record<string, { revenue: number; count: number }> = {};
      for (const order of orders) {
        const d = new Date(order.createdAt);
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        const key = ws.toISOString().slice(0, 10);
        if (!buckets[key]) buckets[key] = { revenue: 0, count: 0 };
        buckets[key].revenue += order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[key].count += 1;
      }
      return {
        granularity: "weekly",
        data: Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([w, v]) => ({ label: w, revenue: Math.round(v.revenue * 100) / 100, orders: v.count })),
      };
    }
  }
  try {
    return await request<RevenueOverTime>(`/reports/revenue${buildQueryString(from, to)}`);
  } catch {
    useMock = true;
    return getReportRevenue(from, to);
  }
}

export async function getReportOrdersByStatus(from?: string, to?: string): Promise<OrdersByStatus> {
  if (useMock) {
    await delay(100);
    const { start, end } = mockDateRange(from, to);
    const orders = mockFilterOrders(start, end);
    const counts: Record<string, number> = { received: 0, preparing: 0, ready: 0, completed: 0 };
    for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
    const total = orders.length;
    return {
      total,
      statuses: Object.entries(counts).map(([status, count]) => ({
        status, count, percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
      })),
    };
  }
  try {
    return await request<OrdersByStatus>(`/reports/orders-by-status${buildQueryString(from, to)}`);
  } catch {
    useMock = true;
    return getReportOrdersByStatus(from, to);
  }
}

export async function getReportTopItems(from?: string, to?: string): Promise<TopItemsReport> {
  if (useMock) {
    await delay(100);
    const { start, end } = mockDateRange(from, to);
    const orders = mockFilterOrders(start, end).filter((o) => o.status !== "cancelled");
    const map: Record<string, { nameAr: string; nameEn: string; quantity: number; revenue: number; categoryAr: string; categoryEn: string }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!map[key]) map[key] = { nameAr: item.nameAr, nameEn: item.nameEn, quantity: 0, revenue: 0, categoryAr: "", categoryEn: "" };
        map[key].quantity += item.quantity;
        map[key].revenue += item.unitPrice * item.quantity;
      }
    }
    const items = Object.values(map);
    const byQuantity = [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const byRevenue = [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    return { byQuantity, byRevenue, categories: [] };
  }
  try {
    return await request<TopItemsReport>(`/reports/top-items${buildQueryString(from, to)}`);
  } catch {
    useMock = true;
    return getReportTopItems(from, to);
  }
}

export async function getReportPeakHours(from?: string, to?: string): Promise<PeakHoursReport> {
  if (useMock) {
    await delay(100);
    const { start, end } = mockDateRange(from, to);
    const orders = mockFilterOrders(start, end);
    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;
    for (const o of orders) {
      const hour = new Date(o.createdAt).getHours();
      hourCounts[hour] += 1;
    }
    const maxCount = Math.max(...Object.values(hourCounts), 1);
    return {
      hours: Object.entries(hourCounts).map(([hour, count]) => ({
        hour: Number(hour), label: `${String(hour).padStart(2, "0")}:00`, count, intensity: Math.round((count / maxCount) * 100) / 100,
      })),
    };
  }
  try {
    return await request<PeakHoursReport>(`/reports/peak-hours${buildQueryString(from, to)}`);
  } catch {
    useMock = true;
    return getReportPeakHours(from, to);
  }
}

export async function getReportUnavailableItems(): Promise<UnavailableItem[]> {
  if (useMock) {
    await delay(50);
    return mockMenuItems.filter((i) => !i.available).map((i) => ({ id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, price: i.price, image: i.image }));
  }
  try {
    return await request<UnavailableItem[]>("/reports/unavailable-items");
  } catch {
    useMock = true;
    return getReportUnavailableItems();
  }
}
