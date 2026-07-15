import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { getOrders } from "@/lib/api";
import { formatPrice, formatDate, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order } from "@/lib/types";

export default function OrderHistory() {
  const { t, isArabic, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getOrders()
      .then((o) => {
        setOrders([...o].reverse());
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (typeFilter !== "all" && o.orderType !== typeFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg mb-4">{t.error}</p>
        <Button onClick={() => window.location.reload()}>{t.retry}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.orderHistory}</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue>{t.admin.orders.filterByStatus}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.orders.allStatuses}</SelectItem>
            <SelectItem value="received">{ORDER_STATUS_LABELS.received[language]}</SelectItem>
            <SelectItem value="preparing">{ORDER_STATUS_LABELS.preparing[language]}</SelectItem>
            <SelectItem value="ready">{ORDER_STATUS_LABELS.ready[language]}</SelectItem>
            <SelectItem value="completed">{ORDER_STATUS_LABELS.completed[language]}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue>{t.admin.orders.filterByType}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.orders.allTypes}</SelectItem>
            <SelectItem value="dine_in">{ORDER_TYPE_LABELS.dine_in[language]}</SelectItem>
            <SelectItem value="takeaway">{ORDER_TYPE_LABELS.takeaway[language]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t.admin.orders.noOrders}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card key={order.id} className="cursor-pointer hover:shadow-card transition-shadow" onClick={() => setSelectedOrder(order)}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{order.orderNumber}</span>
                    <Badge className={STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status][language]}</Badge>
                    <Badge variant="outline">{ORDER_TYPE_LABELS[order.orderType][language]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.customerName} • {timeAgo(order.createdAt, language)}
                    {order.tableNumber && ` • ${t.kitchen.table} ${order.tableNumber}`}
                  </p>
                </div>
                <span className="font-bold text-sm">
                  {formatPrice(order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), language)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{t.admin.orders.orderDetails} #{selectedOrder.orderNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{t.checkout.customerName}:</span> {selectedOrder.customerName}</div>
                  <div><span className="text-muted-foreground">{t.admin.orders.filterByType}:</span> {ORDER_TYPE_LABELS[selectedOrder.orderType][language]}</div>
                  {selectedOrder.tableNumber && <div><span className="text-muted-foreground">{t.kitchen.table}:</span> {selectedOrder.tableNumber}</div>}
                  <div><span className="text-muted-foreground">{t.kitchen.time}:</span> {formatDate(selectedOrder.createdAt, language)}</div>
                </div>
                {selectedOrder.notes && <p className="text-sm text-muted-foreground italic">"{selectedOrder.notes}"</p>}
                <Separator />
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{isArabic ? item.nameAr : item.nameEn} × {item.quantity}</span>
                      <span className="font-semibold">{formatPrice(item.unitPrice * item.quantity, language)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>{t.orderStatus.total}</span>
                  <span>{formatPrice(selectedOrder.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), language)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
