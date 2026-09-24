import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { getInventoryOutOfStockReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { XCircle, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import InventoryReportFilter from "./InventoryReportFilter";
import { generateOutOfStockReportHtml, printReport } from "./inventory-report-pdf";
import ReportErrorState from "./ReportErrorState";

export default function OutOfStockReportPage() {
  const { isArabic } = useLanguage();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory-report-out-of-stock", search, categoryId],
    queryFn: () =>
      getInventoryOutOfStockReport({
        search: search || undefined,
        categoryId: categoryId || undefined,
      }),
  });

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
            printReport(generateOutOfStockReportHtml(data.items, isArabic));
          }}
          disabled={!data}
          className="gap-1.5 shrink-0"
        >
          <Printer className="h-3.5 w-3.5" />
          {isArabic ? "تصدير PDF" : "Export PDF"}
        </Button>
      </div>

      {!isLoading && data && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-50 p-3">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isArabic ? "إجمالي العناصر المنتهية" : "Total Out of Stock Items"}
              </p>
              <p className="text-2xl font-bold">{data.summary.totalItems}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isError ? (
        <ReportErrorState onRetry={() => { void refetch(); }} />
      ) : isLoading ? (
        <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-muted" />{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={XCircle}
          title={isArabic ? "لا يوجد مخزون منتهي" : "No Out of Stock Items"}
          description={isArabic ? "جميع العناصر متوفرة في المخزون" : "All items are in stock"}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? "عناصر نفاد المخزون" : "Out of Stock Items"}</CardTitle>
          </CardHeader>
          <CardContent>
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
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                        <p className="text-xs text-muted-foreground truncate sm:hidden">{item.code || "-"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.code || "-"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                        {item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-end font-mono">0</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700")}>
                          {isArabic ? "نفذ" : "Out"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
