import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import { useCashierCartStore } from "@/stores/cashierCartStore";
import { getMenuItems, getCategories } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import type { Category, MenuItem } from "@/lib/types";

export default function CashierMenuBrowser() {
  const { t, language } = useLanguage();
  const addItem = useCashierCartStore((s) => s.addItem);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [cats, menuItems] = await Promise.all([getCategories(), getMenuItems()]);
      setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
      setItems(menuItems.filter((i) => i.available));
    } catch {
      // error handled by error boundary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = items.filter((item) => {
    if (activeCategory && item.categoryId !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.nameEn.toLowerCase().includes(q) ||
        item.nameAr.includes(search)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto p-3 border-b scrollbar-none">
        <Button
          size="sm"
          variant={activeCategory === null ? "default" : "outline"}
          onClick={() => setActiveCategory(null)}
          className="shrink-0"
        >
          {t.menu?.allCategories || "All"}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategory === cat.id ? "default" : "outline"}
            onClick={() => setActiveCategory(cat.id)}
            className="shrink-0"
          >
            {language === "ar" ? cat.nameAr : cat.nameEn}
          </Button>
        ))}
      </div>

      {/* Items grid */}
      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {t.loading}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {t.noResults}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                onClick={() => addItem(item)}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={language === "ar" ? item.nameAr : item.nameEn}
                    className="h-24 w-full object-cover"
                  />
                )}
                <div className="p-3">
                  <p className="text-sm font-medium truncate">
                    {language === "ar" ? item.nameAr : item.nameEn}
                  </p>
                  <p className="text-sm text-primary font-bold mt-1">
                    {formatPrice(item.price, language)}
                  </p>
                </div>
                <div className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      addItem(item);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
