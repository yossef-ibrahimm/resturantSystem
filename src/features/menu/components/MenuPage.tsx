import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { getMenuItems, getCategories, getOrderByNumber, requestBill } from "@/lib/api";
import { useCartStore } from "@/stores/cartStore";
import { useActiveOrderStore } from "@/stores/activeOrderStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShoppingCart, ReceiptText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem, Category, Order } from "@/lib/types";

export default function MenuPage() {
  const { t, isArabic, language } = useLanguage();
  const { addItem } = useCartStore();
  const { orderNumber } = useActiveOrderStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [billLoading, setBillLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [menuItems, cats] = await Promise.all([getMenuItems(), getCategories()]);
      setItems(menuItems);
      setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
      setLoading(false);
      setError(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!orderNumber) {
      setActiveOrder(null);
      return;
    }
    const fetchActiveOrder = async () => {
      try {
        const order = await getOrderByNumber(orderNumber);
        if (order.paymentStatus === "paid") {
          setActiveOrder(null);
          return;
        }
        setActiveOrder(order);
      } catch {
        setActiveOrder(null);
      }
    };
    fetchActiveOrder();
    const interval = setInterval(fetchActiveOrder, 5000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  const handleRequestBill = async () => {
    if (!activeOrder) return;
    setBillLoading(true);
    try {
      const updated = await requestBill(activeOrder.orderNumber);
      setActiveOrder(updated);
      toast.success(isArabic ? t.orderStatus.billRequestedSuccess : t.orderStatus.billRequestedSuccess);
    } catch {
      toast.error(isArabic ? "فشل إرسال الطلب" : "Failed to send request");
    } finally {
      setBillLoading(false);
    }
  };

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter((i) => i.categoryId === activeCategory);

  const handleAddToCart = (item: MenuItem) => {
    addItem(item);
    toast.success(isArabic ? "تمت الإضافة للسلة" : "Added to cart", {
      description: isArabic ? item.nameAr : item.nameEn,
    });
  };

  if (loading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-6 w-72 mb-8" />
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 text-center">
        <p className="text-destructive text-lg mb-4">{t.error}</p>
        <Button onClick={loadData}>{t.retry}</Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">{t.menu.title}</h1>
      <p className="text-muted-foreground mb-8">{t.menu.subtitle}</p>

      {/* Category Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2" dir="ltr">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          className="rounded-full whitespace-nowrap"
          onClick={() => setActiveCategory("all")}
        >
          {t.menu.allCategories}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategory === cat.id ? "default" : "outline"}
            size="sm"
            className="rounded-full whitespace-nowrap"
            onClick={() => setActiveCategory(cat.id)}
          >
            {isArabic ? cat.nameAr : cat.nameEn}
          </Button>
        ))}
      </div>

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">{t.menu.noItems}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-card transition-shadow group">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={item.image}
                  alt={isArabic ? item.nameAr : item.nameEn}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' fill='%23e5e7eb'%3E%3Crect width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
                  }}
                />
                {!item.available && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Badge variant="destructive" className="text-sm px-3 py-1">
                      {t.menu.soldOut}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-base leading-tight">
                    {isArabic ? item.nameAr : item.nameEn}
                  </h3>
                  <span className="text-accent font-bold whitespace-nowrap text-sm">
                    {formatPrice(item.price, language)}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs mb-3 line-clamp-2">
                  {isArabic ? item.descriptionAr : item.descriptionEn}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!item.available}
                  onClick={() => handleAddToCart(item)}
                  aria-label={`${isArabic ? "أضف إلى السلة" : "Add to cart"}: ${isArabic ? item.nameAr : item.nameEn}`}
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t.menu.addToCart}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Request Bill FAB */}
      {activeOrder && activeOrder.paymentStatus === "unpaid" && !activeOrder.billRequested && (
        <div className="fixed bottom-6 end-6 z-50">
          <Button
            size="lg"
            className="gap-2 rounded-full shadow-lg h-14 px-6"
            onClick={handleRequestBill}
            disabled={billLoading}
          >
            <ReceiptText className="h-5 w-5" />
            {t.orderStatus.requestBill}
          </Button>
        </div>
      )}

      {activeOrder && activeOrder.billRequested && (
        <div className="fixed bottom-6 end-6 z-50">
          <div className="flex items-center gap-2 bg-orange-500 text-white rounded-full px-5 py-3 shadow-lg">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">{t.orderStatus.billRequested}</span>
          </div>
        </div>
      )}
    </div>
  );
}
