import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n";
import { useDateRange, DateRangePicker } from "@/components/DateRangePicker";
import { getAttendanceToday, getAttendanceRecords, getAttendanceSummary } from "@/lib/api";
import type { AttendanceRecord, AttendanceSummaryItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarClock, Clock, RefreshCw, UserCheck, Users } from "lucide-react";

const CAIRO_TZ = "Africa/Cairo";

function cairoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: CAIRO_TZ });
}

function cairoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: CAIRO_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function recordMinutes(r: AttendanceRecord, now: Date): number {
  const end = r.clockOut ? new Date(r.clockOut) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(r.clockIn).getTime()) / 60000));
}

function formatDuration(minutes: number, isArabic: boolean): string {
  if (minutes < 1) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (isArabic) return `${h}س ${m > 0 ? `${m}د` : ""}`;
  return `${h}h ${m > 0 ? `${m}m` : ""}`;
}

function roleLabel(role: string, isArabic: boolean): string {
  if (role === "kitchen_staff") return isArabic ? "مطبخ" : "Kitchen";
  if (role === "waiter") return isArabic ? "جرسون" : "Waiter";
  if (role === "cashier") return isArabic ? "كاشير" : "Cashier";
  return isArabic ? "إدارة" : "Admin";
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={`${accent} rounded-xl p-2.5`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AttendancePage() {
  const { t, isArabic } = useLanguage();
  const [dateRange, setDateRange] = useDateRange();

  const [today, setToday] = useState<AttendanceRecord[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(0);

  const fetchData = useCallback(async (from: string, to: string) => {
    const reqId = ++abortRef.current;
    setLoading(true);
    try {
      const [t, r, s] = await Promise.all([
        getAttendanceToday(),
        getAttendanceRecords(from, to),
        getAttendanceSummary(from, to),
      ]);
      if (reqId !== abortRef.current) return;
      setToday(t);
      setRecords(r);
      setSummary(s);
    } catch {
      // individual api functions handle their own fallbacks
    } finally {
      if (reqId === abortRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();
    fetchData(from, to);
  }, [dateRange, fetchData]);

  const handleRefresh = () => {
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();
    fetchData(from, to);
  };

  const now = new Date();
  const activeNow = today.filter((r) => !r.clockOut);
  const totalMinutes = records.reduce((sum, r) => sum + recordMinutes(r, now), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.attendance.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t.attendance.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Live on-shift strip */}
      {activeNow.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t.attendance.onShiftNow}
            </span>
            {activeNow.map((r) => (
              <Badge key={r.id} variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                {r.user?.name} · {cairoTime(r.clockIn)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={UserCheck}
          label={t.attendance.presentToday}
          value={loading ? "…" : today.length}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <KpiCard
          icon={Clock}
          label={t.attendance.activeNow}
          value={loading ? "…" : activeNow.length}
          accent="bg-blue-500/10 text-blue-600"
        />
        <KpiCard
          icon={CalendarClock}
          label={t.attendance.totalShifts}
          value={loading ? "…" : records.length}
          accent="bg-violet-500/10 text-violet-600"
        />
        <KpiCard
          icon={Users}
          label={t.attendance.totalHours}
          value={loading ? "…" : formatDuration(totalMinutes, isArabic)}
          accent="bg-amber-500/10 text-amber-600"
        />
      </div>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            {t.attendance.records}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t.attendance.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.attendance.staff}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.attendance.role}</TableHead>
                  <TableHead>{t.attendance.date}</TableHead>
                  <TableHead>{t.attendance.clockInTime}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t.attendance.clockOutTime}</TableHead>
                  <TableHead>{t.attendance.duration}</TableHead>
                  <TableHead className="text-end">{t.attendance.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => {
                  const active = !r.clockOut;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.user?.name || "—"}
                        {r.note && (
                          <p className="text-xs text-muted-foreground">{r.note}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {roleLabel(r.user?.role || "", isArabic)}
                      </TableCell>
                      <TableCell>{cairoDate(r.clockIn)}</TableCell>
                      <TableCell>{cairoTime(r.clockIn)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {r.clockOut ? cairoTime(r.clockOut) : "—"}
                      </TableCell>
                      <TableCell>{formatDuration(recordMinutes(r, now), isArabic)}</TableCell>
                      <TableCell className="text-end">
                        <Badge
                          variant={active ? "default" : "outline"}
                          className={active ? "bg-emerald-600" : ""}
                        >
                          {active
                            ? isArabic
                              ? "نشط"
                              : "Active"
                            : t.attendance.completed}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Per-staff summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t.attendance.summary}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : summary.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.attendance.noData}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map((s) => (
                <div key={s.userId} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabel(s.role, isArabic)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-base font-bold">{s.daysPresent}</p>
                      <p className="text-[11px] text-muted-foreground">{t.attendance.daysPresent}</p>
                    </div>
                    <div>
                      <p className="text-base font-bold">{s.shifts}</p>
                      <p className="text-[11px] text-muted-foreground">{t.attendance.totalShifts}</p>
                    </div>
                    <div>
                      <p className="text-base font-bold">{formatDuration(s.totalMinutes, isArabic)}</p>
                      <p className="text-[11px] text-muted-foreground">{t.attendance.totalTime}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}