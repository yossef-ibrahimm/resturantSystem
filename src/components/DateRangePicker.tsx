import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
  preset: string;
}

const CAIRO_TZ = "Africa/Cairo";

function cairoDate(d: Date): Date {
  const parts = d.toLocaleDateString("en-CA", { timeZone: CAIRO_TZ }).split("-");
  return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`);
}

function startOfCairoDay(d: Date): Date {
  const c = cairoDate(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfCairoDay(d: Date): Date {
  const c = cairoDate(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function getPresetRange(preset: string): { from: Date; to: Date } {
  const now = new Date();
  const today = cairoDate(now);

  switch (preset) {
    case "today":
      return { from: startOfCairoDay(today), to: endOfCairoDay(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { from: startOfCairoDay(y), to: endOfCairoDay(y) };
    }
    case "7d":
      return { from: startOfCairoDay(subDays(today, 6)), to: endOfCairoDay(today) };
    case "30d":
      return { from: startOfCairoDay(subDays(today, 29)), to: endOfCairoDay(today) };
    case "this_month":
      return { from: startOfCairoDay(startOfMonth(today)), to: endOfCairoDay(today) };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { from: startOfCairoDay(startOfMonth(lm)), to: endOfCairoDay(endOfMonth(lm)) };
    }
    case "this_year":
      return { from: startOfCairoDay(startOfYear(today)), to: endOfCairoDay(today) };
    case "last_year": {
      const ly = subYears(today, 1);
      return { from: startOfCairoDay(startOfYear(ly)), to: endOfCairoDay(endOfYear(ly)) };
    }
    default:
      return { from: startOfCairoDay(today), to: endOfCairoDay(today) };
  }
}

function serializeDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function useDateRange(): [DateRange, (range: DateRange) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const preset = searchParams.get("preset") || "today";
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const range: DateRange = (() => {
    if (fromStr && toStr) {
      return {
        from: new Date(fromStr),
        to: new Date(toStr),
        preset: "custom",
      };
    }
    const p = getPresetRange(preset);
    return { ...p, preset };
  })();

  const setRange = useCallback(
    (r: DateRange) => {
      const params = new URLSearchParams(searchParams);
      if (r.preset === "custom") {
        params.set("preset", "custom");
        params.set("from", serializeDate(r.from));
        params.set("to", serializeDate(r.to));
      } else {
        params.set("preset", r.preset);
        params.delete("from");
        params.delete("to");
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return [range, setRange];
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(value.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(value.to);

  useEffect(() => {
    setCustomFrom(value.from);
    setCustomTo(value.to);
  }, [value.from, value.to]);

  const presets = [
    { key: "today", label: language === "ar" ? "اليوم" : "Today" },
    { key: "yesterday", label: language === "ar" ? "أمس" : "Yesterday" },
    { key: "7d", label: language === "ar" ? "آخر 7 أيام" : "Last 7 Days" },
    { key: "30d", label: language === "ar" ? "آخر 30 يوم" : "Last 30 Days" },
    { key: "this_month", label: language === "ar" ? "هذا الشهر" : "This Month" },
    { key: "last_month", label: language === "ar" ? "الشهر الماضي" : "Last Month" },
    { key: "this_year", label: language === "ar" ? "هذا العام" : "This Year" },
    { key: "last_year", label: language === "ar" ? "العام الماضي" : "Last Year" },
  ];

  const handlePreset = (preset: string) => {
    const r = getPresetRange(preset);
    onChange({ ...r, preset });
    setOpen(false);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo, preset: "custom" });
      setOpen(false);
    }
  };

  const displayLabel = (() => {
    if (value.preset === "custom") {
      const fmt = (d: Date) => format(d, "MMM d, yyyy");
      return `${fmt(value.from)} – ${fmt(value.to)}`;
    }
    const p = presets.find((p) => p.key === value.preset);
    return p?.label || value.preset;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 font-normal">
          <CalendarIcon className="h-4 w-4" />
          <span>{displayLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          {/* Presets sidebar */}
          <div className="border-b sm:border-b-0 sm:border-e border-border p-2 sm:w-44">
            <div className="space-y-0.5">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={cn(
                    "w-full text-start rounded-md px-3 py-1.5 text-sm transition-colors",
                    value.preset === p.key
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setCustomFrom(value.from);
                  setCustomTo(value.to);
                }}
                className={cn(
                  "w-full text-start rounded-md px-3 py-1.5 text-sm transition-colors",
                  value.preset === "custom"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {language === "ar" ? "مخصص" : "Custom Range"}
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-3 space-y-3">
            <div className="flex gap-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground px-1">
                  {language === "ar" ? "من" : "From"}
                </span>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={(d) => d && setCustomFrom(d)}
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground px-1">
                  {language === "ar" ? "إلى" : "To"}
                </span>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={(d) => d && setCustomTo(d)}
                  className="rounded-md border"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
                {language === "ar" ? "تطبيق" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
