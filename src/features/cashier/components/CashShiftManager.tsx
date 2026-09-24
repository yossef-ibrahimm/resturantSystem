import { useState } from "react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

interface CashShift {
  id: string;
  openedAt: string;
  status: string;
  openingFloat: number;
}

interface CashShiftManagerProps {
  currentShift: CashShift | null;
  onShiftOpened: (shift: CashShift) => void;
  onShiftClosed: () => void;
}

export default function CashShiftManager({ currentShift, onShiftOpened, onShiftClosed }: CashShiftManagerProps) {
  const { language } = useLanguage();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingFloat, setClosingFloat] = useState("");
  const [loading, setLoading] = useState(false);

  const openShift = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/cash-shifts/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ openingFloat: Number(openingFloat) || 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to open shift");
      }
      const shift = await res.json();
      toast.success(language === "ar" ? "تم فتح الوردية" : "Shift opened");
      onShiftOpened(shift);
      setOpenDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to open shift");
    } finally {
      setLoading(false);
    }
  };

  const closeShift = async () => {
    if (!closingFloat) {
      toast.error(language === "ar" ? "أدخل مبلغ الإغلاق" : "Enter closing amount");
      return;
    }
    const parsed = Number(closingFloat);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error(language === "ar" ? "المبلغ غير صالح" : "Invalid amount");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/cash-shifts/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ closingFloat: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to close shift");
      }
      const shift = await res.json();
      const variance = shift.variance;
      toast.success(
        language === "ar"
          ? `تم إغلاق الوردية. الفرق: ${variance}`
          : `Shift closed. Variance: ${variance}`
      );
      onShiftClosed();
      setCloseDialog(false);
      setClosingFloat("");
    } catch (err: any) {
      toast.error(err.message || "Failed to close shift");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Status indicator */}
      {currentShift ? (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
          <Unlock className="h-3 w-3" />
          {language === "ar" ? "وردية مفتوحة" : "Shift Open"}
          <button
            onClick={() => setCloseDialog(true)}
            className="ml-1 hover:text-red-600"
            title={language === "ar" ? "إغلاق الوردية" : "Close Shift"}
          >
            <Lock className="h-3 w-3" />
          </button>
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
          <AlertTriangle className="h-3 w-3" />
          {language === "ar" ? "لا توجد وردية" : "No Shift"}
          <button
            onClick={() => setOpenDialog(true)}
            className="ml-1 hover:text-green-600"
            title={language === "ar" ? "فتح وردية" : "Open Shift"}
          >
            <Unlock className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Open shift dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "فتح وردية" : "Open Shift"}</DialogTitle>
            <DialogDescription className="sr-only">
              {language === "ar" ? "أدخل المبلغ الافتتاحي لفتح وردية جديدة" : "Enter opening float to open a new shift"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{language === "ar" ? "المبلغ الافتتاحي" : "Opening Float"}</Label>
            <Input
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              min={0}
              step="0.01"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={openShift} disabled={loading}>{loading ? "..." : (language === "ar" ? "فتح" : "Open")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close shift dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إغلاق الوردية" : "Close Shift"}</DialogTitle>
            <DialogDescription className="sr-only">
              {language === "ar" ? "أدخل المبلغ الفعلي لإغلاق الوردية" : "Enter actual cash to close the shift"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{language === "ar" ? "المبلغ الفعلي" : "Actual Cash in Drawer"}</Label>
            <Input
              type="number"
              value={closingFloat}
              onChange={(e) => setClosingFloat(e.target.value)}
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={closeShift} disabled={loading}>{loading ? "..." : (language === "ar" ? "إغلاق" : "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
