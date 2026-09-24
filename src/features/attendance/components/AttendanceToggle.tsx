import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n";
import { clockIn, clockOut, getAttendanceStatus } from "@/lib/api";
import type { AttendanceState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function AttendanceToggle() {
  const { isArabic } = useLanguage();
  const [state, setState] = useState<AttendanceState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getAttendanceStatus();
      setState(s);
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async () => {
    if (!state) return;
    if (state.active && !window.confirm(isArabic ? "إنهاء الوردية الآن؟" : "Clock out now?")) {
      return;
    }
    setBusy(true);
    try {
      if (state.active) {
        const s = await clockOut();
        setState(s);
        toast.success(isArabic ? "تم إنهاء الوردية" : "Shift ended");
      } else {
        const s = await clockIn();
        setState(s);
        toast.success(isArabic ? "بدأت الوردية" : "Shift started");
      }
    } catch {
      toast.error(isArabic ? "فشلت العملية، حاول مجدداً" : "Operation failed, try again");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  return (
    <Button
      variant={state.active ? "default" : "outline"}
      size="sm"
      className="gap-1.5"
      onClick={handleToggle}
      disabled={busy}
      title={state.active ? (isArabic ? "إنهاء الوردية" : "Clock out") : (isArabic ? "تسجيل الحضور" : "Clock in")}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state.active ? (
        <LogOut className="h-3.5 w-3.5" />
      ) : (
        <LogIn className="h-3.5 w-3.5" />
      )}
      {state.active
        ? isArabic
          ? "إنهاء الوردية"
          : "Clock out"
        : isArabic
          ? "تسجيل الحضور"
          : "Clock in"}
    </Button>
  );
}