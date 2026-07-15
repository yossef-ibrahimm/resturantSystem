import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { getOrderByNumber } from "@/lib/api";
import { formatPrice, formatDate, timeAgo } from "@/lib/utils";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Package } from "lucide-react";
import type { Order } from "@/lib/types";

export default function OrderStatusPage() {
  const { t, isArabic, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrder = searchParams.get("order") || "";
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialOrder.trim()) {
      handleSearch();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setNotFound(false);
    try {
      const found = await getOrderByNumber(orderNumber.trim());
      if (found) {
        setOrder(found);
        setSearchParams({ order: found.orderNumber });
      } else {
        setOrder(null);
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = order ? ORDER_STATUS_FLOW.indexOf(order.status) : 0;

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{t.orderStatus.title}</h1>
      <p className="text-muted-foreground mb-8">{t.orderStatus.enterNumberPrompt}</p>

      {/* Search */}
      <div className="flex gap-2 mb-8">
        <Input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder={t.orderStatus.enterOrderNumber}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          aria-label={t.orderStatus.enterOrderNumber}
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 me-2" />
          {t.orderStatus.track}
        </Button>
      </div>

      {/* Not found */}
      {notFound && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium">{t.orderStatus.notFound}</p>
          </CardContent>
        </Card>
      )}

      {/* Order details */}
      {order && (
        <div className="space-y-6">
          {/* Status Progress */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.orderStatus.orderNumber}</p>
                  <p className="text-2xl font-bold">#{order.orderNumber}</p>
                </div>
                <Badge className={STATUS_COLORS[order.status]}>
                  {ORDER_STATUS_LABELS[order.status][language]}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  {ORDER_STATUS_FLOW.map((status, idx) => (
                    <div key={status} className="flex flex-col items-center z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          idx <= currentStep
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className="text-xs mt-1 text-center whitespace-nowrap">
                        {ORDER_STATUS_LABELS[status][language]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(currentStep / (ORDER_STATUS_FLOW.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.orderStatus.orderDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t.orderStatus.orderType}</p>
                  <p className="font-medium">{ORDER_TYPE_LABELS[order.orderType][language]}</p>
                </div>
                {order.tableNumber && (
                  <div>
                    <p className="text-muted-foreground">{t.orderStatus.tableNumber}</p>
                    <p className="font-medium">{order.tableNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">{t.checkout.customerName}</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.kitchen.time}</p>
                  <p className="font-medium">{timeAgo(order.createdAt, language)}</p>
                </div>
              </div>

              {order.notes && (
                <div>
                  <p className="text-muted-foreground text-sm">{t.kitchen.notes}</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-muted-foreground text-sm mb-2">{t.orderStatus.items}</p>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {isArabic ? item.nameAr : item.nameEn} × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(item.unitPrice * item.quantity, language)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>{t.orderStatus.total}</span>
                <span>
                  {formatPrice(
                    order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
                    language
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
