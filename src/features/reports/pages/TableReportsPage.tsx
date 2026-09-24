import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { getReportTableOccupancy, getReportStaleTables } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3X3, Clock, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import type { TableOccupancyReport, StaleTableReport } from "@/lib/report-types";

export default function TableReportsPage() {
  const { isArabic } = useLanguage();
  const [occupancy, setOccupancy] = useState<TableOccupancyReport | null>(null);
  const [staleData, setStaleData] = useState<StaleTableReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [occupancyData, staleDataResult] = await Promise.all([
          getReportTableOccupancy(),
          getReportStaleTables(),
        ]);
        setOccupancy(occupancyData);
        setStaleData(staleDataResult);
      } catch {
        // Error handled by error boundary
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isArabic ? "تقارير الطاولات" : "Table Reports"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isArabic
            ? "مراقبة حالة الطاولات والطاولات المتراكبة"
            : "Monitor table status and stale tables"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isArabic ? "إجمالي الطاولات" : "Total Tables"}
            </CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancy?.totalTables || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isArabic ? "الطاولات المحجوزة" : "Occupied Tables"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {occupancy?.occupiedTables || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isArabic ? "الطاولات المتاحة" : "Available Tables"}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {occupancy?.availableTables || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isArabic ? "الطاولات المتراكبة" : "Stale Tables"}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {staleData?.totalStale || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            {isArabic ? "نسبة الإشغال" : "Occupancy Rate"}
          </CardTitle>
          <CardDescription>
            {isArabic
              ? `النسبة الحالية: ${occupancy?.occupancyRate || 0}%`
              : `Current rate: ${occupancy?.occupancyRate || 0}%`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-full rounded-full bg-muted">
            <div
              className="h-4 rounded-full bg-primary transition-all"
              style={{ width: `${occupancy?.occupancyRate || 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            {isArabic ? "تفاصيل الطاولات" : "Table Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {occupancy?.tables.map((table) => (
              <div
                key={table.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  table.occupied ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"
                }`}
              >
                <div>
                  <p className="font-medium">
                    {isArabic ? "طاولة" : "Table"} {table.number}
                    {table.label && <span className="ms-2 text-muted-foreground">({table.label})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "السعة:" : "Capacity:"} {table.capacity}
                  </p>
                </div>
                <Badge variant={table.occupied ? "secondary" : "default"}>
                  {table.occupied
                    ? isArabic ? "محجوزة" : "Occupied"
                    : isArabic ? "متاحة" : "Available"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stale Tables */}
      {staleData && staleData.staleTables.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {isArabic ? "الطاولات المتراكبة" : "Stale Tables"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? `طاولات محجوزة لأكثر من ${staleData.thresholdMinutes} دقيقة`
                : `Tables occupied for more than ${staleData.thresholdMinutes} minutes`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staleData.staleTables.map((table) => (
                <div
                  key={table.id}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {isArabic ? "طاولة" : "Table"} {table.number}
                      {table.label && <span className="ms-2 text-muted-foreground">({table.label})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "العميل:" : "Customer:"} {table.customerName || "-"}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {table.elapsedMinutes} {isArabic ? "دقيقة" : "min"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
