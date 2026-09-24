import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { DateRangePicker, type DateRange } from "@/components/DateRangePicker";
import { getAllStockMovements } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import { ArrowLeftRight, Filter, Search, Printer, RefreshCw } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { generateMovementsReportHtml, printReport } from "./inventory-report-pdf";
import ReportErrorState from "./ReportErrorState";

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

interface ReportsContext {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export default function StockMovementsReportPage() {
  const { isArabic } = useLanguage();
  const { dateRange, setDateRange } = useOutletContext<ReportsContext>();
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [printing, setPrinting] = useState(false);
  const PAGE_SIZE = 25;
  const from = dateRange.from.toISOString();
  const to = dateRange.to.toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory-report-movements", page, typeFilter, searchFilter, from, to],
    queryFn: () =>
      getAllStockMovements({
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        type: typeFilter || undefined,
        search: searchFilter || undefined,
        from,
        to,
      }),
  });

  useEffect(() => {
    setPage(0);
  }, [from, to]);

  const totalMovements = data?.total ?? 0;
  const totalPages = Math.ceil(totalMovements / PAGE_SIZE);

  const handlePrint = async () => {
    if (!data || printing) return;
    setPrinting(true);
    try {
      const allMovements: Awaited<ReturnType<typeof getAllStockMovements>>["movements"] = [];
      for (let skip = 0; skip < totalMovements; skip += 500) {
        const pageData = await getAllStockMovements({ take: 500, skip, type: typeFilter || undefined, search: searchFilter || undefined, from, to });
        allMovements.push(...pageData.movements);
        if (pageData.movements.length < 500) break;
      }
      printReport(generateMovementsReportHtml(allMovements, totalMovements, isArabic));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 sm:w-48">
            <Filter className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              className="h-10 rounded-md border border-input bg-background ps-9 pe-8 text-sm"
            >
              <option value="">{isArabic ? "جميع الأنواع" : "All Types"}</option>
              {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{isArabic ? label.ar : label.en}</option>
              ))}
            </select>
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isArabic ? "بحث بالاسم..." : "Search by name..."}
              value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setPage(0); }}
              className="ps-9"
            />
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <Button
          size="sm"
          onClick={() => { void handlePrint(); }}
          disabled={!data || printing}
          className="gap-1.5 shrink-0"
        >
          {printing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
          {printing ? (isArabic ? "جاري تجهيز التقرير" : "Preparing report") : (isArabic ? "تصدير PDF" : "Export PDF")}
        </Button>
      </div>

      {isError ? (
        <ReportErrorState onRetry={() => { void refetch(); }} />
      ) : isLoading ? (
        <div className="space-y-3"><div className="h-12 animate-pulse rounded-xl bg-muted" />{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : !data?.movements.length ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={isArabic ? "لا توجد حركات" : "No Movements"}
          description={isArabic ? "لا توجد حركات مخزون" : "No stock movements recorded"}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{isArabic ? "حركات المخزون" : "Stock Movements"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isArabic ? `${totalMovements} حركة` : `${totalMovements} movements`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "التاريخ" : "Date"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "النوع" : "Type"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "قبل" : "Before"}</th>
                    <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "بعد" : "After"}</th>
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden md:table-cell">{isArabic ? "السبب" : "Reason"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((mov) => {
                    const typeInfo = MOVEMENT_TYPE_LABELS[mov.type] || { ar: mov.type, en: mov.type, color: "bg-gray-100" };
                    return (
                      <tr key={mov.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(mov.createdAt, isArabic ? "ar" : "en")}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={cn(typeInfo.color, "text-xs")} variant="secondary">
                            {isArabic ? typeInfo.ar : typeInfo.en}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium truncate max-w-[200px]">
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
                        <td className="px-3 py-2.5 text-end font-mono hidden sm:table-cell">{Number(mov.qtyBefore)}</td>
                        <td className="px-3 py-2.5 text-end font-mono hidden sm:table-cell">{Number(mov.qtyAfter)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[150px] truncate hidden md:table-cell">
                          {mov.reason || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? `${page * PAGE_SIZE + 1} - ${Math.min((page + 1) * PAGE_SIZE, totalMovements)} من ${totalMovements}`
                    : `${page * PAGE_SIZE + 1} - ${Math.min((page + 1) * PAGE_SIZE, totalMovements)} of ${totalMovements}`}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {isArabic ? "السابق" : "Prev"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isArabic ? "التالي" : "Next"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
