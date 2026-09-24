import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { getInventorySummaryReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Package, DollarSign, ShoppingCart, AlertTriangle, XCircle, Printer } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { generateSummaryReportHtml, printReport } from "./inventory-report-pdf";
import ReportErrorState from "./ReportErrorState";

export default function InventorySummaryReportPage() {
  const { isArabic } = useLanguage();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory-report-summary"],
    queryFn: getInventorySummaryReport,
  });

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (isError) return <ReportErrorState onRetry={() => { void refetch(); }} />;
  if (!data) return null;

  const { summary, items } = data;

  const kpis = [
    { title: isArabic ? "إجمالي العناصر" : "Total Items", value: summary.totalItems, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { title: isArabic ? "قيمة المخزون الكلية" : "Total Value", value: formatPrice(summary.totalValue, isArabic ? "ar" : "en"), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { title: isArabic ? "متوفر" : "In Stock", value: `${summary.inStockCount} (${formatPrice(summary.inStockValue, isArabic ? "ar" : "en")})`, icon: ShoppingCart, color: "text-green-600", bg: "bg-green-50" },
    { title: isArabic ? "منخفض" : "Low Stock", value: `${summary.lowStockCount} (${formatPrice(summary.lowStockValue, isArabic ? "ar" : "en")})`, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
    { title: isArabic ? "نفذ" : "Out of Stock", value: summary.outOfStockCount, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => printReport(generateSummaryReportHtml(items, summary, isArabic))}
          className="gap-1.5"
        >
          <Printer className="h-3.5 w-3.5" />
          {isArabic ? "تصدير PDF" : "Export PDF"}
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <div className={cn("rounded-lg p-2 sm:p-3", kpi.bg)}>
                <kpi.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", kpi.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{kpi.title}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={isArabic ? "لا توجد عناصر" : "No Items"}
          description={isArabic ? "لا توجد بيانات" : "No data available"}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? "ملخص المخزون الشامل" : "Full Inventory Summary"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الفئة" : "Category"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "تكلفة الوحدة" : "Unit Cost"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "القيمة" : "Value"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const qty = Number(item.qtyOnHand);
                    const cost = Number(item.avgUnitCost);
                    const value = qty * cost;
                    let status: { label: string; color: string };
                    if (qty === 0) status = { label: isArabic ? "نفذ" : "Out", color: "bg-red-100 text-red-700" };
                    else if (qty <= Number(item.minQty)) status = { label: isArabic ? "حرج" : "Critical", color: "bg-orange-100 text-orange-700" };
                    else if (qty <= Number(item.reorderPoint)) status = { label: isArabic ? "منخفض" : "Low", color: "bg-yellow-100 text-yellow-700" };
                    else status = { label: isArabic ? "متوفر" : "In Stock", color: "bg-green-100 text-green-700" };

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
                        <td className="px-3 py-2.5 text-end font-mono">{qty} {item.unit}</td>
                        <td className="px-3 py-2.5 text-end font-mono hidden sm:table-cell">{formatPrice(cost, isArabic ? "ar" : "en")}</td>
                        <td className="px-3 py-2.5 text-end font-mono">{formatPrice(value, isArabic ? "ar" : "en")}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-medium">
                    <td colSpan={2} className="px-3 py-2.5 text-start">{isArabic ? "الإجمالي" : "Total"}</td>
                    <td className="px-3 py-2.5 text-end font-mono">{items.reduce((sum, i) => sum + Number(i.qtyOnHand), 0)}</td>
                    <td className="px-3 py-2.5 hidden sm:table-cell"></td>
                    <td className="px-3 py-2.5 text-end font-mono">{formatPrice(summary.totalValue, isArabic ? "ar" : "en")}</td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
