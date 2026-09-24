import type {
  Category,
  CreateUserResult,
  MenuItem,
  CreateMenuItemInput,
  UpdateMenuItemInput,
  Order,
  User,
  RestaurantSettings,
  UpdateSettingsInput,
} from "./types";
import type { AttendanceRecord, AttendanceState, AttendanceSummaryItem } from "./types";
import type {
  ReportSummary,
  RevenueOverTime,
  OrdersByStatus,
  TopItemsReport,
  PeakHoursReport,
  UnavailableItem,
  TableOccupancyReport,
  StaleTableReport,
} from "./report-types";
import type {
  InventoryCategory,
  InventoryItem,
  StockMovement,
  InventoryDashboard,
  LowStockAlert,
} from "./inventory-types";
import type { Notification, Table, MergedGroup, StaleTable, Payment, PaymentWithOrder } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

let isHandling401 = false;

function handleUnauthorized() {
  if (isHandling401) return;
  isHandling401 = true;

  // Clear auth state
  localStorage.removeItem("tastytable.auth.user");

  // Clear the HttpOnly cookie via backend
  fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});

  // Redirect to login (avoid redirect loops)
  const currentPath = window.location.hash.replace("#", "");
  if (currentPath !== "/admin/login" && currentPath !== "/change-password") {
    window.location.hash = "#/admin/login";
  }

  // Reset flag after a short delay
  setTimeout(() => { isHandling401 = false; }, 1000);
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  // AbortController-backed timeout. Without this, a network failure that
  // neither resolves nor rejects (e.g. socket hang on flaky networks) leaves
  // any caller awaiting forever — which was the upstream cause of the
  // cashier "stuck on loading" payment button bug.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (typeof err === "object" && err !== null && "name" in err && err.name === "AbortError") {
      throw new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
  clearTimeout(timer);

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───

export async function login(email: string, password: string) {
  const data = await request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // Token is set as HttpOnly cookie by the backend — no client-side storage needed
  return { user: data.user };
}

export function logout() {
  // Clear the HttpOnly cookie via the backend logout endpoint
  fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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

export async function deleteCategory(id: string): Promise<void> {
  return request<void>(`/categories/${id}`, { method: "DELETE" });
}

// ─── Menu Items ───

export async function getMenuItems(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/menu-items");
}

export async function createMenuItem(data: CreateMenuItemInput): Promise<MenuItem> {
  return request<MenuItem>("/menu-items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(id: string, data: UpdateMenuItemInput): Promise<MenuItem> {
  return request<MenuItem>(`/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  return request<void>(`/menu-items/${id}`, { method: "DELETE" });
}

// ─── Orders ───

export async function getOrders(
  params: { status?: string; take?: number; cursor?: string; from?: string; to?: string } = {}
): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.take) qs.set("take", String(params.take));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<Order[]>(`/orders${suffix}`);
}

export async function createOrder(data: {
  customerName: string;
  phone?: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: number;
  notes?: string;
  idempotencyKey?: string;
  items: {
    menuItemId: string;
    quantity: number;
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

export async function cancelOrder(id: string, reason: string): Promise<Order> {
  return request<Order>(`/orders/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function acknowledgeBill(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/acknowledge-bill`, {
    method: "PATCH",
  });
}

export async function createPayment(
  orderId: string,
  data: {
    amount: number;
    method: "cash" | "card" | "wallet" | "other";
    idempotencyKey: string;
    note?: string;
  }
): Promise<PaymentWithOrder> {
  return request<PaymentWithOrder>(`/orders/${orderId}/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getOrderPayments(orderId: string): Promise<Payment[]> {
  return request<Payment[]>(`/orders/${orderId}/payments`);
}

// ─── Token-based public endpoints ───

export async function getOrderByToken(orderToken: string): Promise<Order> {
  return request<Order>(`/orders/by-token/${orderToken}`);
}

export async function requestBillByToken(orderToken: string): Promise<Order> {
  return request<Order>(`/orders/by-token/${orderToken}/request-bill`, {
    method: "PATCH",
  });
}

// ─── Discounts (admin) ───

export async function applyDiscount(
  orderId: string,
  data: { amount: number; reason: string }
): Promise<Order> {
  return request<Order>(`/orders/${orderId}/discount`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Refunds (admin) ───

export async function refundPayment(
  paymentId: string,
  data: { amount: number; method?: "cash" | "card" | "wallet" | "other"; reason: string }
): Promise<PaymentWithOrder> {
  return request<PaymentWithOrder>(`/orders/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ refundedPaymentId: paymentId, amount: data.amount, method: data.method || "other", reason: data.reason }),
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
}): Promise<CreateUserResult> {
  return request<CreateUserResult>("/users", {
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

// ─── Image Upload ───

export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload/image`, {
    method: "POST",
    credentials: "include",
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

export async function getReportTableOccupancy(): Promise<TableOccupancyReport> {
  return request<TableOccupancyReport>("/reports/table-occupancy");
}

export async function getReportStaleTables(): Promise<StaleTableReport> {
  return request<StaleTableReport>("/reports/stale-tables");
}

// ─── Attendance ───

export async function getAttendanceStatus(): Promise<AttendanceState> {
  return request<AttendanceState>("/attendance/me/status");
}

export async function clockIn(note?: string): Promise<AttendanceState> {
  return request<AttendanceState>("/attendance/me/clock-in", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function clockOut(): Promise<AttendanceState> {
  return request<AttendanceState>("/attendance/me/clock-out", {
    method: "POST",
  });
}

export async function getAttendanceToday(): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>("/attendance/today");
}

export async function getAttendanceRecords(
  from?: string,
  to?: string,
  userId?: string
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (userId) params.set("userId", userId);
  const qs = params.toString();
  return request<AttendanceRecord[]>(`/attendance/records${qs ? `?${qs}` : ""}`);
}

export async function getAttendanceSummary(
  from?: string,
  to?: string
): Promise<AttendanceSummaryItem[]> {
  return request<AttendanceSummaryItem[]>(`/attendance/summary${buildQueryString(from, to)}`);
}

// ─── Settings ───

export async function getSettings(): Promise<RestaurantSettings> {
  return request<RestaurantSettings>("/settings");
}

export async function updateSettings(data: UpdateSettingsInput): Promise<RestaurantSettings> {
  return request<RestaurantSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function resetSettings(): Promise<RestaurantSettings> {
  return request<RestaurantSettings>("/settings/reset", {
    method: "POST",
  });
}

// ─── Inventory Categories ───

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  return request<InventoryCategory[]>("/inventory/categories");
}

export async function getActiveInventoryCategories(): Promise<InventoryCategory[]> {
  return request<InventoryCategory[]>("/inventory/categories/active");
}

export async function createInventoryCategory(data: {
  nameAr: string;
  nameEn: string;
  description?: string;
  sortOrder?: number;
}): Promise<InventoryCategory> {
  return request<InventoryCategory>("/inventory/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateInventoryCategory(
  id: string,
  data: Partial<{ nameAr: string; nameEn: string; description: string; sortOrder: number; active: boolean }>
): Promise<InventoryCategory> {
  return request<InventoryCategory>(`/inventory/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryCategory(id: string): Promise<void> {
  return request<void>(`/inventory/categories/${id}`, { method: "DELETE" });
}

// ─── Inventory Items ───

export async function getInventoryItems(params?: {
  categoryId?: string;
  active?: string;
  search?: string;
}): Promise<InventoryItem[]> {
  const qs = new URLSearchParams();
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.active) qs.set("active", params.active);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<InventoryItem[]>(`/inventory/items${suffix}`);
}

export async function getInventoryItem(id: string): Promise<InventoryItem> {
  return request<InventoryItem>(`/inventory/items/${id}`);
}

export async function createInventoryItem(data: {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  code?: string;
  description?: string;
  unit?: string;
  minQty?: number;
  reorderPoint?: number;
  recommendedReorderQty?: number;
}): Promise<InventoryItem> {
  return request<InventoryItem>("/inventory/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateInventoryItem(
  id: string,
  data: Partial<{
    categoryId: string;
    nameAr: string;
    nameEn: string;
    code: string;
    description: string;
    unit: string;
    minQty: number;
    reorderPoint: number;
    recommendedReorderQty: number;
    active: boolean;
  }>
): Promise<InventoryItem> {
  return request<InventoryItem>(`/inventory/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  return request<void>(`/inventory/items/${id}`, { method: "DELETE" });
}

// ─── Stock Operations ───

export async function addStock(data: {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  reason?: string;
  note?: string;
  unitCost?: number;
}): Promise<{ movement: StockMovement; newQty: number }> {
  return request("/inventory/stock/add", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deductStock(data: {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  reason?: string;
  note?: string;
  unitCost?: number;
}): Promise<{ movement: StockMovement; newQty: number }> {
  return request("/inventory/stock/deduct", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adjustStock(data: {
  inventoryItemId: string;
  newQuantity: number;
  reason: string;
  note?: string;
}): Promise<{ movement: StockMovement; newQty: number }> {
  return request("/inventory/stock/adjust", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Stock Movements ───

export async function getStockMovements(
  itemId: string,
  params?: { take?: number; skip?: number }
): Promise<{ movements: StockMovement[]; total: number; take: number; skip: number }> {
  const qs = new URLSearchParams();
  if (params?.take) qs.set("take", String(params.take));
  if (params?.skip) qs.set("skip", String(params.skip));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/inventory/movements/${itemId}${suffix}`);
}

export async function getAllStockMovements(params?: {
  take?: number;
  skip?: number;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
}): Promise<{ movements: StockMovement[]; total: number; take: number; skip: number }> {
  const qs = new URLSearchParams();
  if (params?.take) qs.set("take", String(params.take));
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.type) qs.set("type", params.type);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/inventory/movements/all${suffix}`);
}

// ─── Inventory Reports ───

export async function getInventoryAllItemsReport(params?: {
  categoryId?: string;
  search?: string;
}): Promise<{ items: InventoryItem[]; summary: { totalItems: number; totalValue: number; inStock: number; lowStock: number; outOfStock: number } }> {
  const qs = new URLSearchParams();
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/inventory/reports/all-items${suffix}`);
}

export async function getInventoryLowStockReport(params?: {
  categoryId?: string;
  search?: string;
}): Promise<{ items: InventoryItem[]; summary: { totalItems: number; totalValue: number; criticalCount: number } }> {
  const qs = new URLSearchParams();
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/inventory/reports/low-stock${suffix}`);
}

export async function getInventoryOutOfStockReport(params?: {
  categoryId?: string;
  search?: string;
}): Promise<{ items: InventoryItem[]; summary: { totalItems: number } }> {
  const qs = new URLSearchParams();
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/inventory/reports/out-of-stock${suffix}`);
}

export async function getInventorySummaryReport(): Promise<{
  items: InventoryItem[];
  summary: {
    totalItems: number;
    totalValue: number;
    inStockCount: number;
    inStockValue: number;
    lowStockCount: number;
    lowStockValue: number;
    outOfStockCount: number;
  };
}> {
  return request("/inventory/reports/summary");
}

// ─── Inventory Dashboard & Alerts ───

export async function getInventoryDashboard(): Promise<InventoryDashboard> {
  return request("/inventory/dashboard");
}

export async function getInventoryAlerts(): Promise<LowStockAlert[]> {
  return request("/inventory/alerts");
}

// ─── Notifications ───

export async function getNotifications(unreadOnly?: boolean): Promise<Notification[]> {
  const qs = unreadOnly ? "?unreadOnly=true" : "";
  return request<Notification[]>(`/notifications${qs}`);
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return request<{ count: number }>("/notifications/unread-count");
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  return request<Notification>(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  return request<void>("/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: string): Promise<void> {
  return request<void>(`/notifications/${id}`, { method: "DELETE" });
}

// ─── Expense Categories ───

import type {
  MainExpenseCategory,
  SubExpenseCategory,
  Expense,
  ExpenseSummary,
  ExpenseListResponse,
} from "./expense-types";

export async function getMainExpenseCategories(): Promise<MainExpenseCategory[]> {
  return request("/expense-categories/main");
}

export async function getActiveMainExpenseCategories(): Promise<MainExpenseCategory[]> {
  return request("/expense-categories/main/active");
}

export async function getMainExpenseCategory(id: string): Promise<MainExpenseCategory> {
  return request(`/expense-categories/main/${id}`);
}

export async function createMainExpenseCategory(data: {
  nameAr: string;
  nameEn: string;
  description?: string;
}): Promise<MainExpenseCategory> {
  return request("/expense-categories/main", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMainExpenseCategory(
  id: string,
  data: Partial<{ nameAr: string; nameEn: string; description: string; active: boolean }>
): Promise<MainExpenseCategory> {
  return request(`/expense-categories/main/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMainExpenseCategory(id: string): Promise<void> {
  return request(`/expense-categories/main/${id}`, { method: "DELETE" });
}

export async function getSubExpenseCategories(mainCategoryId?: string): Promise<SubExpenseCategory[]> {
  const qs = mainCategoryId ? `?mainCategoryId=${mainCategoryId}` : "";
  return request(`/expense-categories/sub${qs}`);
}

export async function getActiveSubExpenseCategories(): Promise<SubExpenseCategory[]> {
  return request("/expense-categories/sub/active");
}

export async function getSubExpenseCategory(id: string): Promise<SubExpenseCategory> {
  return request(`/expense-categories/sub/${id}`);
}

export async function createSubExpenseCategory(data: {
  mainCategoryId: string;
  nameAr: string;
  nameEn: string;
  description?: string;
}): Promise<SubExpenseCategory> {
  return request("/expense-categories/sub", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubExpenseCategory(
  id: string,
  data: Partial<{ nameAr: string; nameEn: string; description: string; active: boolean; mainCategoryId: string }>
): Promise<SubExpenseCategory> {
  return request(`/expense-categories/sub/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSubExpenseCategory(id: string): Promise<void> {
  return request(`/expense-categories/sub/${id}`, { method: "DELETE" });
}

// ─── Expenses ───

export async function getExpenses(params?: {
  take?: number;
  skip?: number;
  from?: string;
  to?: string;
  subCategoryId?: string;
  mainCategoryId?: string;
  paymentMethod?: string;
  search?: string;
}): Promise<ExpenseListResponse> {
  const qs = new URLSearchParams();
  if (params?.take) qs.set("take", String(params.take));
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.subCategoryId) qs.set("subCategoryId", params.subCategoryId);
  if (params?.mainCategoryId) qs.set("mainCategoryId", params.mainCategoryId);
  if (params?.paymentMethod) qs.set("paymentMethod", params.paymentMethod);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/expenses${suffix}`);
}

export async function getExpense(id: string): Promise<Expense> {
  return request(`/expenses/${id}`);
}

export async function createExpense(data: {
  subCategoryId: string;
  amount: number;
  spentAt: string;
  paymentMethod?: string;
  description: string;
  note?: string;
  receiptUrl?: string;
  cashShiftId?: string;
}): Promise<Expense> {
  return request("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateExpense(
  id: string,
  data: Partial<{
    subCategoryId: string;
    amount: number;
    spentAt: string;
    paymentMethod: string;
    description: string;
    note: string;
    receiptUrl: string;
  }>
): Promise<Expense> {
  return request(`/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  return request(`/expenses/${id}`, { method: "DELETE" });
}

export async function getExpenseSummary(params?: {
  from?: string;
  to?: string;
  mainCategoryId?: string;
  paymentMethod?: string;
  search?: string;
}): Promise<ExpenseSummary> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.mainCategoryId) qs.set("mainCategoryId", params.mainCategoryId);
  if (params?.paymentMethod) qs.set("paymentMethod", params.paymentMethod);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/expenses/summary${suffix}`);
}

// ─── Tables ───

export async function getTables(): Promise<Table[]> {
  return request<Table[]>("/tables");
}

export async function getTable(id: string): Promise<Table> {
  return request<Table>(`/tables/${id}`);
}

export async function createTable(data: {
  number: number;
  label?: string;
  capacity?: number;
}): Promise<Table> {
  return request<Table>("/tables", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTable(
  id: string,
  data: Partial<{ label: string; capacity: number; active: boolean }>
): Promise<Table> {
  return request<Table>(`/tables/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTable(id: string): Promise<void> {
  return request<void>(`/tables/${id}`, { method: "DELETE" });
}

export async function seedTables(): Promise<{ created: number; deactivated: number }> {
  return request("/tables/seed", { method: "POST" });
}

export async function getMergedGroups(): Promise<MergedGroup[]> {
  return request<MergedGroup[]>("/tables/merged");
}

export async function mergeOrders(data: {
  orderIds: string[];
  label?: string;
}): Promise<MergedGroup> {
  return request<MergedGroup>("/tables/merge", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function unmergeOrders(id: string): Promise<void> {
  return request<void>(`/tables/merged/${id}`, { method: "DELETE" });
}

export async function getTableOccupancyReport(): Promise<TableOccupancyReport> {
  return request<TableOccupancyReport>("/tables/occupancy");
}

export async function getStaleTables(): Promise<StaleTable[]> {
  return request<StaleTable[]>("/tables/stale");
}