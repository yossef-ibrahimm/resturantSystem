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

export interface CreateMenuItemInput {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  image?: string;
  available?: boolean;
}

export type UpdateMenuItemInput = Partial<CreateMenuItemInput>;

export type OrderStatus = "received" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderType = "dine_in" | "takeaway";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded";
export type UserRole = "admin" | "kitchen_staff" | "waiter" | "cashier";

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
  orderToken: string;
  customerName: string;
  phone?: string;
  orderType: OrderType;
  tableNumber?: number;
  notes?: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  billRequested?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Money snapshot — server-computed at creation, immutable */
  itemsTotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  serviceRate: number;
  serviceAmount: number;
  total: number;
  paidTotal: number;
  legacyBackfilled?: boolean;
  /** Stage audit trail (Phase 1) */
  preparingAt?: string | null;
  preparingById?: string | null;
  readyAt?: string | null;
  readyById?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancelReason?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  mustChangePassword?: boolean;
}

export interface CreateUserResult extends User {
  temporaryPassword: string;
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

export interface AttendanceRecord {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
  user?: { id: string; name: string; role: string };
}

export interface AttendanceState {
  active: boolean;
  record: AttendanceRecord | null;
}

export interface AttendanceSummaryItem {
  userId: string;
  name: string;
  role: string;
  totalMinutes: number;
  daysPresent: number;
  shifts: number;
}

export interface RestaurantSettings {
  id: string;
  nameAr: string;
  nameEn: string;
  logoUrl: string | null;
  menuBackgroundUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  backgroundColor: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  workingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsappNumber: string | null;
  taxEnabled: boolean;
  taxRate: number;
  serviceEnabled: boolean;
  serviceRate: number;
  totalTables: number;
  tableNumberStart: number;
  tableNumberEnd: number;
  staleThresholdMinutes: number;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<
  Omit<RestaurantSettings, "id" | "updatedAt">
>;

export type NotificationType = "inventory_out_of_stock" | "inventory_low_stock" | "menu_out_of_stock";

export interface Notification {
  id: string;
  type: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  sourceType: string;
  sourceId: string;
  isRead: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface Table {
  id: string;
  number: number;
  label: string | null;
  capacity: number;
  active: boolean;
  occupied: boolean;
  activeOrders: number;
  orders: { id: string; status: string; createdAt: string; customerName: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface MergedGroup {
  id: string;
  label: string | null;
  tableIds: string[];
  orders: {
    id: string;
    orderNumber: string;
    tableNumber: number | null;
    customerName: string;
    total: number;
    status: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface TableOccupancyReport {
  totalTables: number;
  occupiedTables: number;
  availableTables: number;
  occupancyRate: number;
  tables: {
    id: string;
    number: number;
    label: string | null;
    capacity: number;
    occupied: boolean;
    activeOrders: number;
    oldestOrderAt: string | null;
  }[];
}

export interface StaleTable {
  id: string;
  number: number;
  label: string | null;
  capacity: number;
  activeOrders: number;
  oldestOrderAt: string;
  elapsedMinutes: number;
  thresholdMinutes: number;
}
