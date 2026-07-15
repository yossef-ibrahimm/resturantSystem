import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface CartDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export default function CartDrawer({ open, onOpenChange, trigger }: CartDrawerProps) {
  const { t, isArabic, language } = useLanguage();
  const { items, updateQuantity, removeItem, total, itemCount } = useCartStore();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onOpenChange?.(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col w-full sm:max-w-md" side={isArabic ? "left" : "right"}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {t.cart.title}
            {itemCount > 0 && (
              <span className="text-sm text-muted-foreground">({itemCount})</span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">{t.cart.empty}</p>
              <p className="text-sm text-muted-foreground">{t.cart.emptyMessage}</p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              {t.menu.title}
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {items.map((item) => {
                  const price = item.variant
                    ? item.menuItem.price + item.variant.priceAdjust
                    : item.menuItem.price;
                  return (
                    <div key={`${item.menuItem.id}-${item.variant?.id}`} className="flex gap-3">
                      <img
                        src={item.menuItem.image}
                        alt={isArabic ? item.menuItem.nameAr : item.menuItem.nameEn}
                        className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {isArabic ? item.menuItem.nameAr : item.menuItem.nameEn}
                        </p>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">
                            {isArabic ? item.variant.nameAr : item.variant.nameEn}
                          </p>
                        )}
                        <p className="text-accent font-semibold text-sm">
                          {formatPrice(price, language)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={isArabic ? "تقليل الكمية" : "Decrease quantity"}
                            onClick={() =>
                              updateQuantity(
                                item.menuItem.id,
                                item.quantity - 1,
                                item.variant?.id
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center" aria-label={`${isArabic ? "الكمية" : "Quantity"}: ${item.quantity}`}>{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={isArabic ? "زيادة الكمية" : "Increase quantity"}
                            onClick={() =>
                              updateQuantity(
                                item.menuItem.id,
                                item.quantity + 1,
                                item.variant?.id
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ms-auto text-destructive"
                            aria-label={isArabic ? "حذف من السلة" : "Remove from cart"}
                            onClick={() => removeItem(item.menuItem.id, item.variant?.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.cart.subtotal}</span>
                <span className="font-bold text-lg">{formatPrice(total, language)}</span>
              </div>
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                {t.cart.checkout}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
