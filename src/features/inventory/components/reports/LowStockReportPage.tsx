import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { getInventoryLowStockReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, DollarSign, Printer } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import InventoryReportFilter from "./InventoryReportFilter";
import { generateLowStockReportHtml, printReport } from "./inventory-report-pdf";
import ReportErrorState from "./ReportErrorState";

export default function LowStockReportPage() {
  const { isArabic } = useLanguage();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory-report-low-stock", search, categoryId],
    queryFn: () =>
      getInventoryLowStockReport({
        search: search || undefined,
        categoryId: categoryId || undefined,
      }),
  });

  const kpis = data?.summary
    ? [
        { title: isArabic ? "عناصر مخزون منخفض" : "Low Stock Items", value: data.summary.totalItems, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
        { title: isArabic ? "قيمة المخزون المنخفض" : "Low Stock Value", value: formatPrice(data.summary.totalValue, isArabic ? "ar" : "en"), icon: DollarSign, color: "text-orange-600", bg: "bg-orange-50" },
        { title: isArabic ? "حرج" : "Critical", value: data.summary.criticalCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
      ]
    : [];

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
            printReport(generateLowStockReportHtml(data.items, data.summary, isArabic));
          }}
          disabled={!data}
          className="gap-1.5 shrink-0"
        >
          <Printer className="h-3.5 w-3.5" />
          {isArabic ? "تصدير PDF" : "Export PDF"}
        </Button>
      </div>

      {!isLoading && kpis.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
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
          icon={AlertTriangle}
          title={isArabic ? "لا يوجد مخزون منخفض" : "No Low Stock Items"}
          description={isArabic ? "جميع العناصر بمستويات مخزون جيدة" : "All items are at good stock levels"}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? "عناصر المخزون المنخفض" : "Low Stock Items"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الفئة" : "Category"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "نقطة إعادة الطلب" : "Reorder Pt"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap hidden md:table-cell">{isArabic ? "الحد الأدنى" : "Min Qty"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const isCritical = Number(item.qtyOnHand) <= Number(item.minQty);
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                          <p className="text-xs text-muted-foreground truncate sm:hidden">
                            {item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono">{Number(item.qtyOnHand)} {item.unit}</td>
                        <td className="px-3 py-2.5 text-end font-mono hidden sm:table-cell">{Number(item.reorderPoint)}</td>
                        <td className="px-3 py-2.5 text-end font-mono hidden md:table-cell">{Number(item.minQty)}</td>
                        <td className="px-3 py-2.5">
                          <Badge
                            className={cn(isCritical ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}
                            variant="secondary"
                          >
                            {isCritical
                              ? isArabic ? "حرج" : "Critical"
                              : isArabic ? "منخفض" : "Low"}
                          </Badge>
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
