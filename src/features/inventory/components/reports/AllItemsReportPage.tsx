import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { getInventoryAllItemsReport } from "@/lib/api";
import type { InventoryItem } from "@/lib/inventory-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Package, DollarSign, ShoppingCart, AlertTriangle, XCircle, Printer, BarChart3 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import InventoryReportFilter from "./InventoryReportFilter";
import { generateAllItemsReportHtml, printReport } from "./inventory-report-pdf";
import ReportErrorState from "./ReportErrorState";

export default function AllItemsReportPage() {
  const { isArabic } = useLanguage();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory-report-all-items", search, categoryId],
    queryFn: () =>
      getInventoryAllItemsReport({
        search: search || undefined,
        categoryId: categoryId || undefined,
      }),
  });

  const getStockStatus = useCallback((item: InventoryItem) => {
    const qty = Number(item.qtyOnHand);
    if (qty === 0) return { label: isArabic ? "نفذ" : "Out", color: "bg-red-100 text-red-700" };
    if (qty <= Number(item.minQty)) return { label: isArabic ? "حرج" : "Critical", color: "bg-orange-100 text-orange-700" };
    if (qty <= Number(item.reorderPoint)) return { label: isArabic ? "منخفض" : "Low", color: "bg-yellow-100 text-yellow-700" };
    return { label: isArabic ? "متوفر" : "In Stock", color: "bg-green-100 text-green-700" };
  }, [isArabic]);

  const kpis = data?.summary
    ? [
        { title: isArabic ? "إجمالي العناصر" : "Total Items", value: data.summary.totalItems, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
        { title: isArabic ? "قيمة المخزون" : "Inventory Value", value: formatPrice(data.summary.totalValue, isArabic ? "ar" : "en"), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
        { title: isArabic ? "متوفر" : "In Stock", value: data.summary.inStock, icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50" },
        { title: isArabic ? "منخفض" : "Low Stock", value: data.summary.lowStock, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
        { title: isArabic ? "نفذ" : "Out of Stock", value: data.summary.outOfStock, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
      ]
    : [];

  const inventoryStatusSummary = data?.items.reduce(
    (result, item) => {
      const qty = Number(item.qtyOnHand);
      const value = qty * Number(item.avgUnitCost);
      if (qty === 0) result.outOfStockValue += value;
      else if (qty <= Number(item.reorderPoint)) result.lowStockValue += value;
      else result.inStockValue += value;
      return result;
    },
    { inStockValue: 0, lowStockValue: 0, outOfStockValue: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InventoryReportFilter
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
        />
        <Button
          size="sm"
          onClick={() => {
            if (!data) return;
            printReport(generateAllItemsReportHtml(data.items, data.summary, isArabic));
          }}
          disabled={!data}
          className="gap-1.5 shrink-0"
        >
          <Printer className="h-3.5 w-3.5" />
          {isArabic ? "تصدير PDF" : "Export PDF"}
        </Button>
      </div>

      {!isLoading && kpis.length > 0 && (
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
      )}

      {isError ? (
        <ReportErrorState onRetry={() => { void refetch(); }} />
      ) : isLoading ? (
        <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-muted" />{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={Package}
          title={isArabic ? "لا توجد عناصر" : "No Items"}
          description={isArabic ? "لا توجد بيانات في هذه الفترة" : "No data in this period"}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{isArabic ? "ملخص المخزون وجميع العناصر" : "Inventory summary and all items"}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{isArabic ? "نظرة شاملة ثم تفاصيل كل عنصر في نفس الصفحة" : "A complete overview followed by every inventory item"}</p>
            </div>
            <BarChart3 className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
          </CardHeader>
          <CardContent>
            {inventoryStatusSummary && (
              <div className="mb-5 grid grid-cols-1 gap-3 border-b pb-5 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20"><p className="text-xs text-muted-foreground">{isArabic ? "قيمة المتوفر" : "In-stock value"}</p><p className="mt-1 font-semibold text-emerald-700">{formatPrice(inventoryStatusSummary.inStockValue, isArabic ? "ar" : "en")}</p></div>
                <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20"><p className="text-xs text-muted-foreground">{isArabic ? "قيمة المخزون المنخفض" : "Low-stock value"}</p><p className="mt-1 font-semibold text-amber-700">{formatPrice(inventoryStatusSummary.lowStockValue, isArabic ? "ar" : "en")}</p></div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20"><p className="text-xs text-muted-foreground">{isArabic ? "قيمة المنتهي" : "Out-of-stock value"}</p><p className="mt-1 font-semibold text-red-700">{formatPrice(inventoryStatusSummary.outOfStockValue, isArabic ? "ar" : "en")}</p></div>
              </div>
            )}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الكود" : "Code"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden md:table-cell">{isArabic ? "الفئة" : "Category"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الوحدة" : "Unit"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                          <p className="text-xs text-muted-foreground truncate sm:hidden">{item.code || "-"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.code || "-"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                          {item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono">{Number(item.qtyOnHand)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
