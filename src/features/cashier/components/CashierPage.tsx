import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { useCashierOrders } from "@/hooks/useCashierOrders";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { LogOut, Wifi, Grid3X3 } from "lucide-react";
import CashierMenuBrowser from "./CashierMenuBrowser";
import CashierOrderBuilder from "./CashierOrderBuilder";
import CashierUnpaidOrders from "./CashierUnpaidOrders";
import CashierPaymentDialog from "./CashierPaymentDialog";
import CashShiftManager from "./CashShiftManager";
import CashierMergeTables from "./CashierMergeTables";
import AttendanceToggle from "@/features/attendance/components/AttendanceToggle";
import type { Order, MergedGroup } from "@/lib/types";

interface CashShift {
  id: string;
  openedAt: string;
  status: string;
  openingFloat: number;
}

export default function CashierPage() {
  const { t, language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  useCashierOrders();
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMerged, setPaymentMerged] = useState<(MergedGroup & { liveOrders: Order[]; combinedTotal: number; combinedPaid: number; combinedRemaining: number }) | null>(null);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [showMergeTables, setShowMergeTables] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "/api"}/cash-shifts/current`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((shift) => {
        if (shift && shift.id) setCurrentShift(shift);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{t.cashier.title}</h1>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <><Wifi className="h-3 w-3 text-green-500" /> {t.cashier.live}</>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CashShiftManager
            currentShift={currentShift}
            onShiftOpened={(shift) => setCurrentShift(shift)}
            onShiftClosed={() => setCurrentShift(null)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMergeTables(true)}
          >
            <Grid3X3 className="h-4 w-4 me-1" />
            {language === "ar" ? "دمج الطاولات" : "Merge Tables"}
          </Button>
          <AttendanceToggle />
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 me-1" />
            {t.nav.logout}
          </Button>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Menu Browser */}
        <div className="flex flex-col border-e overflow-hidden w-[40%] lg:w-[35%]">
          <CashierMenuBrowser />
        </div>

        {/* Center: Order Builder */}
        <div className="flex flex-col border-e overflow-hidden w-[35%] lg:w-[35%]">
          <CashierOrderBuilder />
        </div>

        {/* Right: Unpaid Orders */}
        <div className="flex flex-col overflow-hidden flex-1">
          <CashierUnpaidOrders
            onPayOrder={(order) => { setPaymentOrder(order); setPaymentMerged(null); }}
            onPayMerged={(merged) => { setPaymentMerged(merged); setPaymentOrder(null); }}
          />
        </div>
      </div>

      {/* Payment Dialog */}
      <CashierPaymentDialog
        order={paymentOrder}
        mergedGroup={paymentMerged}
        onClose={() => { setPaymentOrder(null); setPaymentMerged(null); }}
        hasOpenShift={!!currentShift}
      />

      {/* Merge Tables Dialog */}
      <CashierMergeTables
        open={showMergeTables}
        onClose={() => setShowMergeTables(false)}
      />
    </div>
  );
}
