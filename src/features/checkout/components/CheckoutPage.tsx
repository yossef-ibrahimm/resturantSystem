import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { useCartStore } from "@/stores/cartStore";
import { useActiveOrderStore } from "@/stores/activeOrderStore";
import { createOrder } from "@/lib/api";
import { useSettingsQuery } from "@/hooks/useSettings";
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

const checkoutSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(80, "Name must be at most 80 characters"),
  phone: z.string().max(20, "Phone must be at most 20 characters").optional().or(z.literal("")),
  orderType: z.enum(["dine_in", "takeaway"]),
  tableNumber: z.string().optional().or(z.literal("")),
  notes: z.string().max(280, "Notes must be at most 280 characters").optional().or(z.literal("")),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const { t, isArabic, language } = useLanguage();
  const { items, total, updateQuantity, removeItem, clearCart } = useCartStore();
  const { data: settings } = useSettingsQuery();
  const setOrder = useActiveOrderStore((s) => s.setOrder);
  const navigate = useNavigate();

  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0) : 0;
  const serviceRate = settings?.serviceEnabled ? (settings?.serviceRate ?? 0) : 0;
  const taxAmount = total * taxRate;
  const serviceAmount = total * serviceRate;
  const grandTotal = total + taxAmount + serviceAmount;

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      phone: "",
      orderType: "dine_in",
      tableNumber: "",
      notes: "",
    },
  });

  const orderType = watch("orderType");

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0 || submittingRef.current) return;

    if (data.orderType === "dine_in") {
      const parsed = Number(data.tableNumber);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        toast.error(isArabic ? "رقم الطاولة غير صالح (1-500)" : "Invalid table number (1-500)");
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const order = await createOrder({
        customerName: data.customerName.trim(),
        phone: data.phone?.trim() || undefined,
        orderType: data.orderType,
        tableNumber: data.orderType === "dine_in" ? Number(data.tableNumber) : undefined,
        notes: data.notes?.trim() || undefined,
        idempotencyKey,
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          variant: item.variant ? (isArabic ? item.variant.nameAr : item.variant.nameEn) : undefined,
          notes: item.notes,
        })),
      });
      clearCart();
      toast.success(t.checkout.orderPlaced);
      setOrder(order.orderNumber, order.status, order.orderToken);
      navigate(`/order-status?token=${order.orderToken}`);
    } catch {
      toast.error(t.error);
    } finally {
      submittingRef.current = false;
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
        <div className="lg:col-span-2 space-y-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.checkout.customerName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.checkout.customerName} *</Label>
                <Input
                  id="name"
                  {...register("customerName")}
                  placeholder={t.checkout.customerNamePlaceholder}
                  aria-invalid={!!errors.customerName}
                  aria-describedby={errors.customerName ? "name-error" : undefined}
                />
                {errors.customerName && (
                  <p id="name-error" className="text-xs text-destructive">{errors.customerName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t.checkout.phone}</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder={t.checkout.phonePlaceholder}
                  dir="ltr"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </CardContent>
         
            <CardHeader>
              
              <CardTitle>{t.checkout.orderType}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={orderType}
                onValueChange={(v) => setValue("orderType", v as "dine_in" | "takeaway")}
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
                    {...register("tableNumber")}
                    placeholder={t.checkout.tableNumberPlaceholder}
                    min={1}
                    max={500}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">{t.checkout.notes}</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder={t.checkout.notesPlaceholder}
                  rows={3}
                  aria-invalid={!!errors.notes}
                  aria-describedby={errors.notes ? "notes-error" : undefined}
                />
                {errors.notes && (
                  <p id="notes-error" className="text-xs text-destructive">{errors.notes.message}</p>
                )}
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

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t.cart.subtotal}</span>
                  <span>{formatPrice(total, language)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{t.cart.tax} ({(taxRate * 100).toFixed(1)}%)</span>
                    <span>{formatPrice(taxAmount, language)}</span>
                  </div>
                )}
                {serviceRate > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{t.cart.service} ({(serviceRate * 100).toFixed(1)}%)</span>
                    <span>{formatPrice(serviceAmount, language)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between font-bold text-lg">
                <span>{t.cart.total}</span>
                <span className="text-primary">{formatPrice(grandTotal, language)}</span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit(onSubmit)}
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
