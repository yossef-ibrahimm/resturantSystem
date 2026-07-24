import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useCartStore } from "@/stores/cartStore";
import { useActiveOrderStore } from "@/stores/activeOrderStore";
import { createOrder } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function CheckoutPage() {
  const { t, isArabic, language } = useLanguage();
  const { items, total, updateQuantity, removeItem, clearCart } = useCartStore();
  const setOrder = useActiveOrderStore((s) => s.setOrder);
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!customerName.trim()) errs.customerName = t.checkout.requiredField;
    if (orderType === "dine_in" && !tableNumber.trim()) errs.tableNumber = t.checkout.requiredField;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || items.length === 0) return;
    setSubmitting(true);
    try {
      const order = await createOrder({
        customerName: customerName.trim(),
        phone: phone.trim() || undefined,
        orderType,
        tableNumber: orderType === "dine_in" ? Number(tableNumber) : undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          nameAr: item.menuItem.nameAr,
          nameEn: item.menuItem.nameEn,
          quantity: item.quantity,
          unitPrice: item.variant ? item.menuItem.price + item.variant.priceAdjust : item.menuItem.price,
          variant: item.variant ? (isArabic ? item.variant.nameAr : item.variant.nameEn) : undefined,
          notes: item.notes,
        })),
      });
      clearCart();
      toast.success(t.checkout.orderPlaced);
      setOrder(order.orderNumber, order.status);
      navigate(`/order-status?order=${order.orderNumber}`);
    } catch {
      toast.error(t.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container py-16 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground text-lg mb-4">{t.cart.empty}</p>
        <Button asChild>
          <Link to="/">{t.cart.continueShopping}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">{t.checkout.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.checkout.customerName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.checkout.customerName} *</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.checkout.customerNamePlaceholder}
                  className={errors.customerName ? "border-destructive" : ""}
                />
                {errors.customerName && (
                  <p className="text-xs text-destructive">{errors.customerName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t.checkout.phone}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.checkout.phonePlaceholder}
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.checkout.orderType}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={orderType}
                onValueChange={(v) => setOrderType(v as "dine_in" | "takeaway")}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="dine_in"
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    orderType === "dine_in"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="dine_in" id="dine_in" className="sr-only" />
                  🍽️ {t.checkout.dineIn}
                </Label>
                <Label
                  htmlFor="takeaway"
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    orderType === "takeaway"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="takeaway" id="takeaway" className="sr-only" />
                  📦 {t.checkout.takeaway}
                </Label>
              </RadioGroup>

              {orderType === "dine_in" && (
                <div className="space-y-2">
                  <Label htmlFor="table">{t.checkout.tableNumber} *</Label>
                  <Input
                    id="table"
                    type="number"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder={t.checkout.tableNumberPlaceholder}
                    className={errors.tableNumber ? "border-destructive" : ""}
                  />
                  {errors.tableNumber && (
                    <p className="text-xs text-destructive">{errors.tableNumber}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">{t.checkout.notes}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.checkout.notesPlaceholder}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>{t.cart.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => {
                  const price = item.variant
                    ? item.menuItem.price + item.variant.priceAdjust
                    : item.menuItem.price;
                  return (
                    <div key={`${item.menuItem.id}-${item.variant?.id}`} className="flex gap-3">
                      <img
                        src={item.menuItem.image}
                        alt={isArabic ? item.menuItem.nameAr : item.menuItem.nameEn}
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isArabic ? item.menuItem.nameAr : item.menuItem.nameEn}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1, item.variant?.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-xs">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1, item.variant?.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeItem(item.menuItem.id, item.variant?.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {formatPrice(price * item.quantity, language)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="flex items-center justify-between font-bold text-lg">
                <span>{t.cart.total}</span>
                <span>{formatPrice(total, language)}</span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t.loading : t.checkout.placeOrder}
                {!submitting && <ArrowRight className="h-4 w-4 ms-2" />}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
