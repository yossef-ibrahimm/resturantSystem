export interface ReportSummary {
  revenue: number;
  revenueChange: number | null;
  orderCount: number;
  orderCountChange: number | null;
  avgValue: number;
  avgValueChange: number | null;
  dineIn: number;
  takeaway: number;
  grossSales: number;
  discounts: number;
  tax: number;
  serviceCharge: number;
  netSales: number;
  refunds: number;
  collectedCash: number;
  range: { from: string; to: string };
}

export interface RevenueBucket {
  label: string;
  revenue: number;
  orders: number;
}

export interface RevenueOverTime {
  granularity: "hourly" | "daily" | "weekly";
  data: RevenueBucket[];
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface OrdersByStatus {
  total: number;
  statuses: StatusBreakdown[];
}

export interface TopItem {
  nameAr: string;
  nameEn: string;
  quantity: number;
  revenue: number;
  categoryAr: string;
  categoryEn: string;
}

export interface CategoryBreakdown {
  nameAr: string;
  nameEn: string;
  revenue: number;
  quantity: number;
}

export interface TopItemsReport {
  byQuantity: TopItem[];
  byRevenue: TopItem[];
  categories: CategoryBreakdown[];
}

export interface PeakHour {
  hour: number;
  label: string;
  count: number;
  intensity: number;
}

export interface PeakHoursReport {
  hours: PeakHour[];
}

export interface UnavailableItem {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
  image: string;
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
    customerName: string | null;
  }[];
  range: { from: string; to: string };
}

export interface StaleTableReport {
  staleTables: {
    id: string;
    number: number;
    label: string | null;
    capacity: number;
    activeOrders: number;
    oldestOrderAt: string;
    elapsedMinutes: number;
    thresholdMinutes: number;
    customerName: string | null;
  }[];
  thresholdMinutes: number;
  totalStale: number;
}
