import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { getInventoryDashboard, getAllStockMovements } from "@/lib/api";
import type { InventoryDashboard, StockMovementType } from "@/lib/inventory-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, AlertTriangle, XCircle, DollarSign, TrendingDown, History, Boxes, ArrowLeftRight, Filter } from "lucide-react";
import { cn, formatPrice, formatDate } from "@/lib/utils";

const MOVEMENT_TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  initial: { ar: "جرد أولي", en: "Opening", color: "bg-blue-100 text-blue-700" },
  purchase: { ar: "مشتريات", en: "Purchase", color: "bg-green-100 text-green-700" },
  sale: { ar: "بيع", en: "Sale", color: "bg-purple-100 text-purple-700" },
  consumption: { ar: "استهلاك", en: "Consumption", color: "bg-orange-100 text-orange-700" },
  waste: { ar: "هالك", en: "Waste", color: "bg-red-100 text-red-700" },
  damage: { ar: "تلف", en: "Damage", color: "bg-red-100 text-red-700" },
  expired: { ar: "منتهي الصلاحية", en: "Expired", color: "bg-red-100 text-red-700" },
  adjustment_up: { ar: "زيادة", en: "Adjust +", color: "bg-green-100 text-green-700" },
  adjustment_down: { ar: "نقص", en: "Adjust -", color: "bg-yellow-100 text-yellow-700" },
  return: { ar: "مرتجع", en: "Return", color: "bg-blue-100 text-blue-700" },
};

const OUTBOUND_TYPES: StockMovementType[] = ["sale", "consumption", "waste", "damage", "expired", "adjustment_down"];
void OUTBOUND_TYPES;

export default function InventoryDashboardPage() {
  const { t, isArabic } = useLanguage();
  const [movementsPage, setMovementsPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const PAGE_SIZE = 20;

  const { data: dashboard, isLoading } = useQuery<InventoryDashboard>({
    queryKey: ["inventory-dashboard"],
    queryFn: getInventoryDashboard,
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["all-stock-movements", movementsPage, typeFilter, searchFilter],
    queryFn: () =>
      getAllStockMovements({
        take: PAGE_SIZE,
        skip: movementsPage * PAGE_SIZE,
        type: typeFilter || undefined,
        search: searchFilter || undefined,
      }),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t.loading}</div>;
  }

  if (!dashboard) return null;

  const kpis = [
    {
      title: isArabic ? "إجمالي العناصر" : "Total Items",
      value: dashboard.totalItems,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: isArabic ? "قيمة المخزون" : "Inventory Value",
      value: formatPrice(dashboard.totalInventoryValue, isArabic ? "ar" : "en"),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: isArabic ? "مخزون منخفض" : "Low Stock",
      value: dashboard.lowStockCount,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: isArabic ? "مخزون حرج" : "Critical",
      value: dashboard.criticalStockCount,
      icon: TrendingDown,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: isArabic ? "نفذ من المخزون" : "Out of Stock",
      value: dashboard.outOfStockCount,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  const totalMovements = movementsData?.total ?? 0;
  const totalPages = Math.ceil(totalMovements / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isArabic ? "لوحة المخزون" : "Inventory Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isArabic ? "نظرة عامة على حالة المخزون" : "Overview of inventory status"}
          </p>
        </div>
      </div>

      {/* Quick navigation */}
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/inventory/items">
          <Button>
            <Boxes className="me-2 h-4 w-4" />
            {isArabic ? "عناصر المخزون" : "Inventory Items"}
          </Button>
        </Link>
        <Link to="/admin/inventory/stock">
          <Button variant="outline">
            <ArrowLeftRight className="me-2 h-4 w-4" />
            {isArabic ? "حركات المخزون" : "Stock Operations"}
          </Button>
        </Link>
        <Link to="/admin/inventory/categories">
          <Button variant="outline">
            <Package className="me-2 h-4 w-4" />
            {isArabic ? "الفئات" : "Categories"}
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <div className={cn("rounded-lg p-2 sm:p-3", kpi.bg)}>
                <kpi.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{kpi.title}</p>
                <p className="text-lg sm:text-2xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Items */}
        {dashboard.lowStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                {isArabic ? "مخزون منخفض" : "Low Stock Items"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard.lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">
                        {isArabic ? "نقطة إعادة الطلب:" : "Reorder:"} {item.reorderPoint}
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700 shrink-0 ms-2" variant="secondary">
                      {item.qtyOnHand} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Out of Stock */}
        {dashboard.outOfStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                {isArabic ? "نفذ من المخزون" : "Out of Stock"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard.outOfStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                    <Badge className="bg-red-100 text-red-700 shrink-0 ms-2" variant="secondary">0 {item.unit}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stock Movements Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {isArabic ? "حركات المخزون" : "Stock Movements"}
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Filter className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setMovementsPage(0); }}
                  className="h-9 rounded-md border border-input bg-background ps-9 pe-8 text-sm"
                >
                  <option value="">{isArabic ? "جميع الأنواع" : "All Types"}</option>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{isArabic ? label.ar : label.en}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Package className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={isArabic ? "بحث بالاسم..." : "Search by name..."}
                  value={searchFilter}
                  onChange={(e) => { setSearchFilter(e.target.value); setMovementsPage(0); }}
                  className="h-9 ps-9 max-w-[200px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="py-8 text-center text-muted-foreground">{t.loading}</div>
          ) : !movementsData?.movements.length ? (
            <p className="py-8 text-center text-muted-foreground">
              {isArabic ? "لا توجد حركات" : "No movements recorded"}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "النوع" : "Type"}</th>
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                      <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "السبب" : "Reason"}</th>
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "التاريخ" : "Date"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsData.movements.map((mov) => {
                      const typeInfo = MOVEMENT_TYPE_LABELS[mov.type] || { ar: mov.type, en: mov.type, color: "bg-gray-100" };
                      return (
                        <tr key={mov.id} className="border-b last:border-0">
                          <td className="px-3 py-2.5">
                            <Badge className={cn(typeInfo.color, "text-xs")} variant="secondary">
                              {isArabic ? typeInfo.ar : typeInfo.en}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium whitespace-nowrap">
                              {mov.inventoryItem
                                ? isArabic
                                  ? mov.inventoryItem.nameAr
                                  : mov.inventoryItem.nameEn
                                : "-"}
                            </p>
                          </td>
                          <td className={cn(
                            "px-3 py-2.5 text-end font-mono whitespace-nowrap",
                            mov.quantity > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {mov.quantity > 0 ? "+" : ""}{Number(mov.quantity)} {mov.unit}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[150px] truncate">
                            {mov.reason || "-"}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                            {formatDate(mov.createdAt, isArabic ? "ar" : "en")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {isArabic
                      ? `${movementsPage * PAGE_SIZE + 1} - ${Math.min((movementsPage + 1) * PAGE_SIZE, totalMovements)} من ${totalMovements}`
                      : `${movementsPage * PAGE_SIZE + 1} - ${Math.min((movementsPage + 1) * PAGE_SIZE, totalMovements)} of ${totalMovements}`}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementsPage === 0}
                      onClick={() => setMovementsPage((p) => p - 1)}
                    >
                      {isArabic ? "السابق" : "Prev"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementsPage >= totalPages - 1}
                      onClick={() => setMovementsPage((p) => p + 1)}
                    >
                      {isArabic ? "التالي" : "Next"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
