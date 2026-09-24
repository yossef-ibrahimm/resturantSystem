import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import { getOrders, mergeOrders, unmergeOrders, getMergedGroups } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link, Unlink, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Order, MergedGroup } from "@/lib/types";

interface CashierMergeTablesProps {
  open: boolean;
  onClose: () => void;
}

interface OrderGroup {
  tableNumber: number | null;
  orders: Order[];
}

export default function CashierMergeTables({ open, onClose }: CashierMergeTablesProps) {
  const { isArabic, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [mergedGroups, setMergedGroups] = useState<MergedGroup[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [ordersData, groupsData] = await Promise.all([
        getOrders({ status: "all" }),
        getMergedGroups(),
      ]);
      // Filter to active orders only (not cancelled, not completed, not fully paid)
      const activeOrders = ordersData.filter(
        (o) => o.status !== "cancelled" && o.status !== "completed" && o.paymentStatus !== "paid"
      );
      setOrders(activeOrders);
      setMergedGroups(groupsData);
    } catch {
      toast.error(isArabic ? "فشل تحميل الطلبات" : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    if (open) {
      loadData();
      setSelectedOrderIds([]);
    }
  }, [open, loadData]);

  // Group orders by table number
  const ordersByTable: OrderGroup[] = (() => {
    const groups = new Map<number | null, Order[]>();
    for (const order of orders) {
      const key = order.tableNumber ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(order);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a ?? 9999) - (b ?? 9999))
      .map(([tableNumber, ords]) => ({ tableNumber, orders: ords }));
  })();

  // Separate ungrouped and already-merged orders
  const ungroupedOrders = orders.filter((o) => !o.mergedGroupId);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleMerge = async () => {
    if (selectedOrderIds.length < 2) {
      toast.error(isArabic ? "اختر طلبين على الأقل" : "Select at least 2 orders");
      return;
    }

    // Verify selected orders are from different tables
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
    const tableNumbers = new Set(selectedOrders.map((o) => o.tableNumber).filter(Boolean));
    if (tableNumbers.size < 2) {
      toast.error(isArabic ? "اختر طلبات من طاولات مختلفة" : "Select orders from different tables");
      return;
    }

    try {
      await mergeOrders({ orderIds: selectedOrderIds });
      toast.success(isArabic ? "تم دمج الطلبات" : "Orders merged successfully");
      setSelectedOrderIds([]);
      await loadData();
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : undefined) || (isArabic ? "فشل دمج الطلبات" : "Failed to merge orders"));
    }
  };

  const handleUnmerge = async (groupId: string) => {
    try {
      await unmergeOrders(groupId);
      toast.success(isArabic ? "تم فك الدمج" : "Orders unmerged successfully");
      await loadData();
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : undefined) || (isArabic ? "فشل فك الدمج" : "Failed to unmerge orders"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {isArabic ? "دمج الطلبات" : "Merge Orders"}
          </DialogTitle>
          <DialogDescription>
            {isArabic
              ? "اختر طلباتاً من طاولات مختلفة ثم اضغط دمج"
              : "Select orders from different tables, then tap Merge"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">{isArabic ? "جاري التحميل..." : "Loading..."}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 pr-2">
              {/* Active Orders by Table */}
              {ungroupedOrders.length === 0 && mergedGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {isArabic ? "لا توجد طلبات نشطة" : "No active orders"}
                </div>
              )}

              {ordersByTable.map(({ tableNumber, orders: tableOrders }) => {
                const ungroupedInTable = tableOrders.filter((o) => !o.mergedGroupId);
                if (ungroupedInTable.length === 0) return null;

                return (
                  <div key={tableNumber ?? "takeaway"} className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 border-b">
                      <h4 className="text-sm font-semibold">
                        {tableNumber != null
                          ? `${isArabic ? "طاولة" : "Table"} ${tableNumber}`
                          : isArabic ? "تيك أواي" : "Takeaway"}
                      </h4>
                    </div>
                    <div className="divide-y">
                      {ungroupedInTable.map((order) => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => handleSelectOrder(order.id)}
                            className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                              isSelected
                                ? "bg-primary/10"
                                : "hover:bg-muted/30"
                            }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">#{order.orderNumber}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {order.items.length} {isArabic ? "صنف" : "items"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {order.customerName}
                              </p>
                            </div>
                            <span className="text-sm font-medium shrink-0">
                              {formatPrice(order.total, language)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Already Merged Groups */}
              {mergedGroups.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      {isArabic ? "طلبات مجتمعة حالياً" : "Currently Merged"}
                    </h4>
                    {mergedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b">
                          <span className="text-sm font-medium">{group.label}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive"
                            onClick={() => handleUnmerge(group.id)}
                          >
                            <Unlink className="h-3.5 w-3.5 me-1" />
                            {isArabic ? "فك الدمج" : "Unmerge"}
                          </Button>
                        </div>
                        <div className="divide-y">
                          {group.orders.map((order) => (
                            <div key={order.id} className="flex items-center gap-3 px-3 py-2">
                              <span className="font-bold text-sm">#{order.orderNumber}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.tableNumber != null
                                  ? `${isArabic ? "طاولة" : "Table"} ${order.tableNumber}`
                                  : isArabic ? "تيك أواي" : "Takeaway"}
                                {" — "}
                                {order.customerName}
                              </span>
                              <span className="ms-auto text-sm font-medium shrink-0">
                                {formatPrice(order.total, language)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Merge Action Bar */}
        {selectedOrderIds.length >= 2 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {isArabic
                  ? `تم اختيار ${selectedOrderIds.length} طلبات من طاولات مختلفة`
                  : `${selectedOrderIds.length} orders selected from different tables`}
              </span>
            </div>
            <Button size="sm" onClick={handleMerge}>
              <Link className="h-4 w-4 me-1" />
              {isArabic ? "دمج" : "Merge"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
