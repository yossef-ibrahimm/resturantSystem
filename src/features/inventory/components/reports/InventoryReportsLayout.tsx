import { Outlet, NavLink } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Package,
  AlertTriangle,
  XCircle,
  BarChart3,
  ArrowLeftRight,
} from "lucide-react";

const REPORT_TABS = [
  { to: "/admin/inventory/reports/all-items", labelAr: "جميع العناصر", labelEn: "All Items", icon: Package },
  { to: "/admin/inventory/reports/low-stock", labelAr: "مخزون منخفض", labelEn: "Low Stock", icon: AlertTriangle },
  { to: "/admin/inventory/reports/out-of-stock", labelAr: "نفذ من المخزون", labelEn: "Out of Stock", icon: XCircle },
  { to: "/admin/inventory/reports/summary", labelAr: "ملخص شامل", labelEn: "Full Summary", icon: BarChart3 },
  { to: "/admin/inventory/reports/movements", labelAr: "حركات المخزون", labelEn: "Movements", icon: ArrowLeftRight },
];

export default function InventoryReportsLayout() {
  const { isArabic } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isArabic ? "تقارير المخزون" : "Inventory Reports"}
        </h1>
      </div>

      {/* Tabs */}
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
            <span>{isArabic ? tab.labelAr : tab.labelEn}</span>
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <Outlet />
    </div>
  );
}
