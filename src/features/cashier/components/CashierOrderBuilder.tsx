import { useState } from "react";
import { useLanguage } from "@/i18n";
import { useCashierCartStore } from "@/stores/cashierCartStore";
import { useCreateCashierOrder } from "@/hooks/useCashierOrders";
import { useSettingsQuery } from "@/hooks/useSettings";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2, Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";

export default function CashierOrderBuilder() {
  const { t, language } = useLanguage();
  const { data: settings } = useSettingsQuery();
  const {
    items, customerName, phone, orderType, tableNumber, notes,
    total,
    setCustomerName, setPhone, setOrderType, setTableNumber, setNotes,
    removeItem, updateQuantity, clearCart,
  } = useCashierCartStore();
  const createOrder = useCreateCashierOrder();
  const [submitting, setSubmitting] = useState(false);

  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0) : 0;
  const serviceRate = settings?.serviceEnabled ? (settings?.serviceRate ?? 0) : 0;
  const taxAmount = total * taxRate;
  const serviceAmount = total * serviceRate;
  const grandTotal = total + taxAmount + serviceAmount;

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error(language === "ar" ? "اسم الزبون مطلوب" : "Customer name is required");
      return;
    }
    if (customerName.trim().length > 80) {
      toast.error(language === "ar" ? "اسم الزبون طويل جداً (حد أقصى 80 حرفاً)" : "Customer name is too long (max 80 characters)");
      return;
    }
    if (items.length === 0) {
      toast.error(language === "ar" ? "أضف أصناف للطلب" : "Add items to the order");
      return;
    }
    if (orderType === "dine_in") {
      if (!tableNumber) {
        toast.error(language === "ar" ? "رقم الطاولة مطلوب" : "Table number is required");
        return;
      }
      const parsed = Number(tableNumber);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        toast.error(language === "ar" ? "رقم الطاولة غير صالح (1-500)" : "Invalid table number (1-500)");
        return;
      }
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `cashier-${crypto.randomUUID()}`;
      await createOrder.mutateAsync({
        customerName: customerName.trim(),
        phone: phone.trim() || undefined,
        orderType,
        tableNumber: orderType === "dine_in" ? Number(tableNumber) : undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          variant: i.variant?.nameEn || i.variant?.nameAr || undefined,
          notes: i.notes || undefined,
        })),
      });
      clearCart();
      toast.success(language === "ar" ? "تم إرسال الطلب" : "Order sent to kitchen");
    } catch (err: any) {
      toast.error(err?.message || language === "ar" ? "فشل إرسال الطلب" : "Failed to send order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Customer Info */}
      <div className="p-3 border-b space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t.checkout.customerName} *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={language === "ar" ? "اسم الزبون" : "Customer name"}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.checkout.phone}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={language === "ar" ? "رقم الهاتف" : "Phone number"}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t.checkout.orderType}</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={orderType === "dine_in" ? "default" : "outline"}
                onClick={() => setOrderType("dine_in")}
                className="flex-1 h-9"
              >
                {t.checkout.dineIn}
              </Button>
              <Button
                size="sm"
                variant={orderType === "takeaway" ? "default" : "outline"}
                onClick={() => setOrderType("takeaway")}
                className="flex-1 h-9"
              >
                {t.checkout.takeaway}
              </Button>
            </div>
          </div>
          {orderType === "dine_in" && (
            <div className="space-y-1">
              <Label className="text-xs">{t.checkout.tableNumber}</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="#"
                min={1}
                max={500}
                className="h-9"
              />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.checkout.notes}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={language === "ar" ? "ملاحظات..." : "Notes..."}
            rows={2}
            className="resize-none text-sm"
          />
        </div>
      </div>

      {/* Items list */}
      <ScrollArea className="flex-1 p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            {language === "ar" ? "أضف أصناف من القائمة" : "Add items from the menu"}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const price = item.variant
                ? item.menuItem.price + item.variant.priceAdjust
                : item.menuItem.price;
              return (
                <div key={`${item.menuItem.id}-${item.variant?.id}`} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {language === "ar" ? item.menuItem.nameAr : item.menuItem.nameEn}
                      {item.variant && (
                        <span className="text-muted-foreground ms-1">
                          ({language === "ar" ? item.variant.nameAr : item.variant.nameEn})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-primary">{formatPrice(price, language)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1, item.variant?.id)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1, item.variant?.id)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-medium w-20 text-end">
                    {formatPrice(price * item.quantity, language)}
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeItem(item.menuItem.id, item.variant?.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Totals & Submit */}
      <div className="border-t p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{language === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
          <span>{formatPrice(total, language)}</span>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{language === "ar" ? "الضريبة" : "Tax"} ({(taxRate * 100).toFixed(1)}%)</span>
            <span>{formatPrice(taxAmount, language)}</span>
          </div>
        )}
        {serviceRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{language === "ar" ? "رسوم الخدمة" : "Service"} ({(serviceRate * 100).toFixed(1)}%)</span>
            <span>{formatPrice(serviceAmount, language)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-bold">
          <span>{language === "ar" ? "الإجمالي" : "Total"}</span>
          <span className="text-primary">{formatPrice(grandTotal, language)}</span>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={items.length === 0 || submitting}
          onClick={handleSubmit}
        >
          <Send className="h-4 w-4 me-2" />
          {submitting ? t.loading : t.cashier.sendOrder}
        </Button>
      </div>
    </div>
  );
}
