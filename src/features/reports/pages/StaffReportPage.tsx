import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n";
import type { DateRange } from "@/components/DateRangePicker";
import { useState, useEffect, useCallback, useRef } from "react";
import { getAttendanceRecords, getAttendanceSummary } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, RefreshCw } from "lucide-react";
import type { AttendanceRecord, AttendanceSummaryItem } from "@/lib/types";

interface ReportsContext {
  dateRange: DateRange;
}

const CAIRO_TZ = "Africa/Cairo";

function formatCairoDate(value: string, language: string): string {
  return new Date(value).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", {
    timeZone: CAIRO_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCairoTime(value: string, language: string): string {
  return new Date(value).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-GB", {
    timeZone: CAIRO_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string, language: string): string {
  if (role === "admin") return language === "ar" ? "مدير" : "Admin";
  if (role === "kitchen_staff") return language === "ar" ? "مطبخ" : "Kitchen";
  if (role === "cashier") return language === "ar" ? "كاشير" : "Cashier";
  return language === "ar" ? "جرسون" : "Waiter";
}

function formatDuration(minutes: number, language: string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return language === "ar"
    ? `${h}س ${m > 0 ? `${m}د` : ""}`
    : `${h}h ${m > 0 ? `${m}m` : ""}`;
}

function generateStaffReportHtml(
  summary: AttendanceSummaryItem[],
  records: AttendanceRecord[],
  language: string
): string {
  const summaryRows = summary
    .map(
      (s) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${s.name}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${roleLabel(s.role, language)}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${s.daysPresent}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${s.shifts}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;font-weight:600;color:#111">${formatDuration(s.totalMinutes, language)}</td>
    </tr>`
    )
    .join("");

  const recordRows = records
    .slice(0, 50)
    .map(
      (rec) => {
        const duration = rec.clockOut
          ? (new Date(rec.clockOut).getTime() - new Date(rec.clockIn).getTime()) / 60000
          : 0;
        return `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 10px;text-align:right;font-size:10pt;color:#111">${rec.user?.name || "—"}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#666">${formatCairoDate(rec.clockIn, language)}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${formatCairoTime(rec.clockIn, language)}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;color:#111">${rec.clockOut ? formatCairoTime(rec.clockOut, language) : "—"}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10pt;font-weight:600;color:#111">${rec.clockOut ? formatDuration(duration, language) : "—"}</td>
    </tr>`;
      }
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير الفريق</title>
<style>
  @page { margin:15mm 20mm; size:A4; }
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI','Noto Naskh Arabic','Tahoma',sans-serif; font-size:10pt; color:#000; background:#fff; direction:rtl; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { padding:6px 10px; font-size:9pt; font-weight:700; color:#374151; border-bottom:2px solid #999; text-align:right; background:#f9fafb; }
  @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>

<h1 style="font-size:16pt;font-weight:700;margin-bottom:16px">تقرير الفريق</h1>

<div style="border-bottom:2px solid #999;margin-bottom:16px"></div>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">ملخص الحضور</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الموظف</th>
      <th style="text-align:center;width:80px">الدور</th>
      <th style="text-align:center;width:80px">أيام الحضور</th>
      <th style="text-align:center;width:70px">الورديات</th>
      <th style="text-align:center;width:100px">إجمالي الوقت</th>
    </tr>
  </thead>
  <tbody>${summaryRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>

<h2 style="font-size:12pt;font-weight:700;margin-bottom:8px">سجل الحضور</h2>
<table style="border:1px solid #d1d5db;margin-bottom:24px">
  <thead>
    <tr>
      <th style="text-align:right">الموظف</th>
      <th style="text-align:center;width:80px">التاريخ</th>
      <th style="text-align:center;width:80px">حضور</th>
      <th style="text-align:center;width:80px">انصراف</th>
      <th style="text-align:center;width:80px">المدة</th>
    </tr>
  </thead>
  <tbody>${recordRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">لا توجد سجلات</td></tr>'}</tbody>
</table>

<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:8pt;color:#666">
  تقرير الفريق - Tasty Table
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export default function StaffReportPage() {
  const { dateRange } = useOutletContext<ReportsContext>();
  const { t, language } = useLanguage();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [rec, sum] = await Promise.all([
        getAttendanceRecords(from, to),
        getAttendanceSummary(from, to),
      ]);
      if (reqId !== abortRef.current) return;
      setRecords(rec);
      setSummary(sum);
    } catch {} finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange.from.toISOString(), dateRange.to.toISOString());
  }, [dateRange, fetchData]);

  const handlePrint = () => {
    const html = generateStaffReportHtml(summary, records, language);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const totalShifts = summary.reduce((acc, s) => acc + s.shifts, 0);
  const totalHours = summary.reduce((acc, s) => acc + s.totalMinutes, 0) / 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t.reports.staff}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData(dateRange.from.toISOString(), dateRange.to.toISOString())} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 me-1 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={loading} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{language === "ar" ? "الموظفين" : "Staff"}</p>
          <p className="text-xl font-bold">{summary.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t.reports.totalShifts}</p>
          <p className="text-xl font-bold">{totalShifts}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t.reports.totalHours}</p>
          <p className="text-xl font-bold">{totalHours.toFixed(1)}h</p>
        </CardContent></Card>
      </div>

      {/* Staff Summary Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.staffAttendance}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الموظف" : "Staff"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الدور" : "Role"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "أيام الحضور" : "Days"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الورديات" : "Shifts"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "الوقت" : "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : summary.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  summary.map((item) => (
                    <tr key={item.userId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-right font-medium">{item.name}</td>
                      <td className="p-3 text-center text-muted-foreground">
                        {roleLabel(item.role, language)}
                      </td>
                      <td className="p-3 text-center">{item.daysPresent}</td>
                      <td className="p-3 text-center">{item.shifts}</td>
                      <td className="p-3 text-center font-medium">{formatDuration(item.totalMinutes, language)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h3 className="font-semibold">{t.reports.attendanceRecords}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-muted-foreground">{language === "ar" ? "الموظف" : "Staff"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "حضور" : "In"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "انصراف" : "Out"}</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">{language === "ar" ? "المدة" : "Duration"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>)
                ) : records.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t.reports.noData}</td></tr>
                ) : (
                  records.slice(0, 20).map((rec) => {
                    const duration = rec.clockOut
                      ? (new Date(rec.clockOut).getTime() - new Date(rec.clockIn).getTime()) / 60000
                      : 0;
                    return (
                      <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-right">{rec.user?.name || "—"}</td>
                        <td className="p-3 text-center text-muted-foreground">
                          {new Date(rec.clockIn).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}
                        </td>
                        <td className="p-3 text-center">
                          {new Date(rec.clockIn).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3 text-center">
                          {rec.clockOut
                            ? new Date(rec.clockOut).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                        <td className="p-3 text-center font-medium">
                          {rec.clockOut ? formatDuration(duration, language) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
