import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ShoppingCart,
  UtensilsCrossed,
  DollarSign,
  Users,
  Package,
  Receipt,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
} from "lucide-react";
import { DateRangePicker, useDateRange } from "@/components/DateRangePicker";

export function useReportDateRange() {
  return useDateRange();
}

const REPORT_TABS = [
  { to: "/admin/reports/sales", labelKey: "sales", icon: BarChart3 },
  { to: "/admin/reports/orders", labelKey: "orders", icon: ShoppingCart },
  { to: "/admin/reports/menu", labelKey: "menu", icon: UtensilsCrossed },
  { to: "/admin/reports/revenue", labelKey: "revenue", icon: DollarSign },
  { to: "/admin/reports/staff", labelKey: "staff", icon: Users },
  { to: "/admin/reports/inventory", labelKey: "inventory", icon: Package },
  { to: "/admin/reports/expenses", labelKey: "expenses", icon: Receipt },
];

const INVENTORY_TABS = [
  { to: "/admin/reports/inventory", labelAr: "جميع العناصر", labelEn: "All Items", icon: Package },
  { to: "/admin/reports/inventory/low-stock", labelAr: "مخزون منخفض", labelEn: "Low Stock", icon: AlertTriangle },
  { to: "/admin/reports/inventory/out-of-stock", labelAr: "نفذ من المخزون", labelEn: "Out of Stock", icon: XCircle },
  { to: "/admin/reports/inventory/movements", labelAr: "حركات المخزون", labelEn: "Movements", icon: ArrowLeftRight },
];

export default function ReportsLayout() {
  const { t, isArabic } = useLanguage();
  const [dateRange, setDateRange] = useReportDateRange();
  const location = useLocation();
  const isInventorySection = location.pathname.startsWith("/admin/reports/inventory");
  const isInlineDateReport = location.pathname.endsWith("/expenses") || location.pathname.endsWith("/inventory/movements");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.reports.title}</h1>
        </div>
        {!isInventorySection && !isInlineDateReport && (
          <div className="flex items-center gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {REPORT_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <tab.icon className="h-4 w-4" />
            <span>{t.reports[tab.labelKey as keyof typeof t.reports]}</span>
          </NavLink>
        ))}
      </div>

      {/* Inventory Sub-tabs */}
      {isInventorySection && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
          {INVENTORY_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/admin/reports/inventory"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <tab.icon className="h-4 w-4" />
              <span>{isArabic ? tab.labelAr : tab.labelEn}</span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Content */}
      <Outlet context={{ dateRange, setDateRange }} />
    </div>
  );
}
