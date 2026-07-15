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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───

export async function login(email: string, password: string) {
  const data = await request<{ user: any; token: string }>("/auth/login", {
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

export async function getCategories() {
  return request<any[]>("/categories");
}

export async function createCategory(data: { nameAr: string; nameEn: string; sortOrder?: number }) {
  return request<any>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: Partial<{ nameAr: string; nameEn: string; sortOrder: number }>) {
  return request<any>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string) {
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}

// ─── Menu Items ───

export async function getMenuItems() {
  return request<any[]>("/menu-items");
}

export async function getMenuItem(id: string) {
  return request<any>(`/menu-items/${id}`);
}

export async function createMenuItem(data: any) {
  return request<any>("/menu-items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(id: string, data: any) {
  return request<any>(`/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: string) {
  return request<void>(`/menu-items/${id}`, { method: "DELETE" });
}

// ─── Orders ───

export async function getOrders() {
  return request<any[]>("/orders");
}

export async function getOrderById(id: string) {
  return request<any>(`/orders/${id}`);
}

export async function getOrderByNumber(orderNumber: string) {
  return request<any>(`/orders/by-number/${orderNumber}`);
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
}) {
  return request<any>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(id: string, status: string) {
  return request<any>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Users ───

export async function getUsers() {
  return request<any[]>("/users");
}

export async function createUser(data: { email: string; name: string; role: string; password?: string }) {
  return request<any>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleUserActive(id: string) {
  return request<any>(`/users/${id}/toggle-active`, { method: "PATCH" });
}

export async function deleteUser(id: string) {
  return request<void>(`/users/${id}`, { method: "DELETE" });
}

// ─── Dashboard ───

export async function getDashboardStats() {
  return request<any>("/dashboard/stats");
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
