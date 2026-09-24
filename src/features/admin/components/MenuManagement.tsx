import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { getMenuItems, getCategories, createMenuItem, updateMenuItem, deleteMenuItem, createCategory, deleteCategory } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import type { MenuItem, Category } from "@/lib/types";

const menuItemSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or greater"),
  categoryId: z.string().min(1),
  available: z.boolean(),
  image: z.string().optional(),
});

type MenuItemFormData = z.infer<typeof menuItemSchema>;

const categorySchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function MenuManagement() {
  const { t, isArabic, language } = useLanguage();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setItemValue,
    watch: watchItem,
    reset: resetItem,
    formState: { errors: itemErrors },
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: { nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", price: 0, categoryId: "", available: true, image: "" },
  });

  const {
    register: registerCat,
    handleSubmit: handleSubmitCat,
    reset: resetCat,
    formState: { errors: catErrors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { nameAr: "", nameEn: "" },
  });

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

  const filteredItems = filterCategory === "all"
    ? items
    : items.filter((i) => i.categoryId === filterCategory);

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    resetItem({
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      descriptionAr: item.descriptionAr,
      descriptionEn: item.descriptionEn,
      price: Number(item.price),
      categoryId: item.categoryId,
      available: item.available,
      image: item.image,
    });
    setItemDialogOpen(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    resetItem({ nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", price: 0, categoryId: categories[0]?.id || "", available: true, image: "" });
    setItemDialogOpen(true);
  };

  const onSaveItem = async (data: MenuItemFormData) => {
    const payload = {
      ...data,
      descriptionAr: data.descriptionAr || "",
      descriptionEn: data.descriptionEn || "",
      image: data.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    };
    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        toast.success(isArabic ? "تم تحديث الطبق" : "Item updated");
      } else {
        await createMenuItem(payload);
        toast.success(isArabic ? "تمت إضافة الطبق" : "Item added");
      }
      setItemDialogOpen(false);
      loadData();
    } catch {
      toast.error(t.error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t.admin.menu.deleteConfirm)) return;
    try {
      await deleteMenuItem(id);
      toast.success(isArabic ? "تم حذف الطبق" : "Item deleted");
      loadData();
    } catch {
      toast.error(t.error);
    }
  };

  const onSaveCategory = async (data: CategoryFormData) => {
    try {
      await createCategory({ nameAr: data.nameAr, nameEn: data.nameEn, sortOrder: categories.length + 1 });
      resetCat();
      setCatDialogOpen(false);
      toast.success(isArabic ? "تمت إضافة الفئة" : "Category added");
      loadData();
    } catch {
      toast.error(t.error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t.admin.menu.categoryDeleteConfirm)) return;
    try {
      await deleteCategory(id);
      toast.success(isArabic ? "تم حذف الفئة" : "Category deleted");
      loadData();
    } catch {
      toast.error(t.error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg mb-4">{t.error}</p>
        <Button onClick={loadData}>{t.retry}</Button>
      </div>
    );
  }

  const watchedCategoryId = watchItem("categoryId");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.admin.menuManagement}</h1>
        <div className="flex gap-2">
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="h-4 w-4 me-2" />
                {t.admin.menu.addCategory}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.admin.menu.addCategory}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitCat(onSaveCategory)} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.menu.categoryNameAr}</Label>
                  <Input {...registerCat("nameAr")} dir="rtl" />
                  {catErrors.nameAr && <p className="text-xs text-destructive">{isArabic ? "مطلوب" : "Required"}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.menu.categoryNameEn}</Label>
                  <Input {...registerCat("nameEn")} />
                  {catErrors.nameEn && <p className="text-xs text-destructive">{isArabic ? "مطلوب" : "Required"}</p>}
                </div>
                <Button type="submit" className="w-full">{t.save}</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={itemDialogOpen} onOpenChange={(open) => { setItemDialogOpen(open); if (!open) { resetItem(); setEditingItem(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 me-2" />
                {t.admin.menu.addItem}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? t.admin.menu.editItem : t.admin.menu.addItem}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitItem(onSaveItem)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.itemNameAr}</Label>
                    <Input {...registerItem("nameAr")} dir="rtl" />
                    {itemErrors.nameAr && <p className="text-xs text-destructive">{isArabic ? "مطلوب" : "Required"}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.itemNameEn}</Label>
                    <Input {...registerItem("nameEn")} />
                    {itemErrors.nameEn && <p className="text-xs text-destructive">{isArabic ? "مطلوب" : "Required"}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.descriptionAr}</Label>
                    <Textarea {...registerItem("descriptionAr")} dir="rtl" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.descriptionEn}</Label>
                    <Textarea {...registerItem("descriptionEn")} rows={2} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.price}</Label>
                    <Input type="number" step="0.01" {...registerItem("price")} dir="ltr" />
                    {itemErrors.price && <p className="text-xs text-destructive">{isArabic ? "سعر غير صالح" : "Invalid price"}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.category}</Label>
                    <Select value={watchedCategoryId} onValueChange={(v) => setItemValue("categoryId", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{isArabic ? cat.nameAr : cat.nameEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {itemErrors.categoryId && <p className="text-xs text-destructive">{isArabic ? "اختر فئة" : "Select a category"}</p>}
                  </div>
                </div>
                <ImageUploader
                  label={t.admin.menu.image}
                  initialUrl={editingItem?.image}
                  onChange={(url) => setItemValue("image", url || "")}
                />
                <div className="flex items-center gap-3">
                  <Switch checked={watchItem("available")} onCheckedChange={(v) => setItemValue("available", v)} />
                  <Label>{t.admin.menu.availability}: {watchItem("available") ? t.admin.menu.inStock : t.admin.menu.outOfStock}</Label>
                </div>
                <Button type="submit" className="w-full">{t.save}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter */}
      <Select value={filterCategory} onValueChange={setFilterCategory}>
        <SelectTrigger className="w-48">
          <SelectValue>{filterCategory === "all" ? t.admin.menu.allCategories : categories.find((c) => c.id === filterCategory)?.[isArabic ? "nameAr" : "nameEn"]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.admin.menu.allCategories}</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>{isArabic ? cat.nameAr : cat.nameEn}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Items Table */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <img
                src={item.image}
                alt={isArabic ? item.nameAr : item.nameEn}
                className="h-16 w-16 rounded object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' fill='%23e5e7eb'%3E%3Crect width='64' height='64'/%3E%3C/svg%3E";
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                  <Badge variant={item.available ? "default" : "destructive"}>
                    {item.available ? t.admin.menu.inStock : t.admin.menu.outOfStock}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatPrice(item.price, language)}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={t.admin.menu.editItem}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem(item.id)} aria-label={t.admin.menu.deleteItem}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Categories management */}
      <Card>
        <CardHeader>
          <CardTitle>{t.admin.menu.addCategory}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{isArabic ? cat.nameAr : cat.nameEn}</span>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(cat.id)} aria-label={t.admin.menu.deleteItem}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
