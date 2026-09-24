import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { getActiveInventoryCategories } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

interface InventoryReportFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
}

export default function InventoryReportFilter({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
}: InventoryReportFilterProps) {
  const { isArabic } = useLanguage();
  const [draftSearch, setDraftSearch] = useState(search);

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftSearch !== search) onSearchChange(draftSearch);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch, onSearchChange, search]);

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories-active"],
    queryFn: getActiveInventoryCategories,
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={isArabic ? "بحث بالاسم أو الكود..." : "Search by name or code..."}
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          className="ps-9"
        />
      </div>
      <label className="relative min-w-0 sm:w-52">
        <SlidersHorizontal className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 ps-9 pe-8 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-label={isArabic ? "الفئة" : "Category"}
        >
          <option value="">{isArabic ? "جميع الفئات" : "All Categories"}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {isArabic ? cat.nameAr : cat.nameEn}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
