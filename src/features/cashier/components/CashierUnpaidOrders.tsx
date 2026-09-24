import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { useCashierOrders, getUnpaidOrders } from "@/hooks/useCashierOrders";
import { getMergedGroups } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ORDER_STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { CreditCard, Clock, ShoppingCart, Link } from "lucide-react";
import type { Order, MergedGroup } from "@/lib/types";

interface CashierUnpaidOrdersProps {
  onPayOrder: (order: Order) => void;
  onPayMerged: (merged: MergedGroup & { liveOrders: Order[]; combinedTotal: number; combinedPaid: number; combinedRemaining: number }) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function CashierUnpaidOrders({ onPayOrder, onPayMerged }: CashierUnpaidOrdersProps) {
  const { t, language, isArabic } = useLanguage();
  const { data: orders, isLoading } = useCashierOrders();
  const unpaid = orders ? getUnpaidOrders(orders) : [];
  const [mergedGroups, setMergedGroups] = useState<MergedGroup[]>([]);

  useEffect(() => {
    getMergedGroups()
      .then(setMergedGroups)
      .catch(() => {});
  }, []);

  // Build a set of order IDs that belong to a merged group
  const mergedOrderIds = new Set(mergedGroups.flatMap((g) => g.orders.map((o) => o.id)));

  // Separate standalone (ungrouped) orders from merged-group orders
  const standaloneOrders = unpaid.filter((o) => !mergedOrderIds.has(o.id));

  // For merged groups, use the live order data (with latest totals) instead of stale snapshots
  const liveMergedGroups = mergedGroups
    .map((group) => {
      const liveOrders = group.orders
        .map((go) => unpaid.find((o) => o.id === go.id))
        .filter(Boolean) as Order[];
      if (liveOrders.length === 0) return null;
      const combinedTotal = liveOrders.reduce((sum, o) => sum + o.total, 0);
      const combinedPaid = liveOrders.reduce((sum, o) => sum + o.paidTotal, 0);
      const combinedRemaining = combinedTotal - combinedPaid;
      return { ...group, liveOrders, combinedTotal, combinedPaid, combinedRemaining };
    })
    .filter(Boolean) as (MergedGroup & {
    liveOrders: Order[];
    combinedTotal: number;
    combinedPaid: number;
    combinedRemaining: number;
  })[];

  const totalCount = standaloneOrders.length + liveMergedGroups.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          {t.cashier.unpaidOrders}
        </h2>
        <Badge variant="secondary">{totalCount}</Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {t.loading}
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <CreditCard className="h-8 w-8 opacity-50" />
            {language === "ar" ? "لا يوجد طلبات غير محاسبة" : "No unpaid orders"}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Merged Groups */}
            {liveMergedGroups.map((group) => (
              <Card key={group.id} className="overflow-hidden border-primary/40">
                {/* Group header */}
                <div className="flex items-center justify-between bg-primary/5 px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Link className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-semibold">
                      {group.label || (isArabic ? "طلب مدمج" : "Merged Order")}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {group.liveOrders.length} {isArabic ? "طلبات" : "orders"}
                  </Badge>
                </div>

                {/* Individual orders within the group */}
                <div className="divide-y">
                  {group.liveOrders.map((order) => {
                    const remaining = order.total - order.paidTotal;
                    return (
                      <div key={order.id} className="px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">#{order.orderNumber}</span>
                            <Badge
                              variant="outline"
                              className={`${STATUS_COLORS[order.status]} text-[10px]`}
                            >
                              {ORDER_STATUS_LABELS[order.status]?.[language] || order.status}
                            </Badge>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {timeAgo(order.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {order.customerName}
                            {order.tableNumber && ` — ${isArabic ? "طاولة" : "Table"} ${order.tableNumber}`}
                          </span>
                          <span>
                            {order.items.length} {isArabic ? "صنف" : "items"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {formatPrice(order.total, language)}
                          </span>
                          {order.paidTotal > 0 && (
                            <span className="text-xs text-orange-600">
                              {isArabic ? "المتبقي" : "Remaining"}: {formatPrice(remaining, language)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Group total + Pay All */}
                <div className="border-t bg-muted/30 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {isArabic ? "الإجمالي" : "Total"}
                    </span>
                    <span className="text-base font-bold text-primary">
                      {formatPrice(group.combinedTotal, language)}
                    </span>
                  </div>
                  {group.combinedPaid > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {isArabic ? "المدفوع" : "Paid"}: {formatPrice(group.combinedPaid, language)}
                      </span>
                      <span className="text-orange-600 font-medium">
                        {isArabic ? "المتبقي" : "Remaining"}: {formatPrice(group.combinedRemaining, language)}
                      </span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => onPayMerged(group)}
                  >
                    <CreditCard className="h-3.5 w-3.5 me-1" />
                    {isArabic ? "دفع الكل" : "Pay All"} — {formatPrice(group.combinedRemaining, language)}
                  </Button>
                </div>
              </Card>
            ))}

            {/* Standalone Orders */}
            {standaloneOrders.map((order) => {
              const remaining = order.total - order.paidTotal;
              const isPartial = order.paidTotal > 0;
              return (
                <Card key={order.id} className="overflow-hidden">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">#{order.orderNumber}</span>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[order.status]}
                        >
                          {ORDER_STATUS_LABELS[order.status]?.[language] || order.status}
                        </Badge>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(order.createdAt)}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {order.customerName}
                      {order.tableNumber && ` — ${language === "ar" ? "طاولة" : "Table"} ${order.tableNumber}`}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {order.items.length} {language === "ar" ? "صنف" : "items"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatPrice(order.total, language)}
                      </span>
                    </div>

                    {isPartial && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{language === "ar" ? "المدفوع" : "Paid"}: {formatPrice(order.paidTotal, language)}</span>
                        <span className="text-orange-600 font-medium">
                          {language === "ar" ? "المتبقي" : "Remaining"}: {formatPrice(remaining, language)}
                        </span>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => onPayOrder(order)}
                    >
                      <CreditCard className="h-4 w-4 me-1" />
                      {language === "ar" ? "دفع" : "Pay"} — {formatPrice(remaining, language)}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
