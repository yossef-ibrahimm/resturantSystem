import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, UtensilsCrossed, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem, Category } from "@/lib/types";

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
  const [newCatAr, setNewCatAr] = useState("");
  const [newCatEn, setNewCatEn] = useState("");

  // Form state
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    price: "",
    categoryId: "",
    available: true,
    image: "",
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

  const resetForm = () => {
    setForm({ nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", price: "", categoryId: categories[0]?.id || "", available: true, image: "" });
    setEditingItem(null);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      descriptionAr: item.descriptionAr,
      descriptionEn: item.descriptionEn,
      price: String(item.price),
      categoryId: item.categoryId,
      available: item.available,
      image: item.image,
    });
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!form.nameAr.trim() || !form.nameEn.trim()) {
      toast.error(isArabic ? "أدخل اسم الطبق بالعربية والإنجليزية" : "Enter item name in both languages");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      toast.error(isArabic ? "أدخل سعراً صالحاً" : "Enter a valid price");
      return;
    }
    if (!form.categoryId) {
      toast.error(isArabic ? "اختر فئة" : "Select a category");
      return;
    }
    const data = {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn,
      price: Number(form.price),
      categoryId: form.categoryId,
      available: form.available,
      image: form.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    };

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, data);
        toast.success(isArabic ? "تم تحديث الطبق" : "Item updated");
      } else {
        await createMenuItem(data);
        toast.success(isArabic ? "تمت إضافة الطبق" : "Item added");
      }
      setItemDialogOpen(false);
      resetForm();
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

  const handleAddCategory = async () => {
    if (!newCatAr.trim() || !newCatEn.trim()) return;
    try {
      await createCategory({ nameAr: newCatAr, nameEn: newCatEn, sortOrder: categories.length + 1 });
      setNewCatAr("");
      setNewCatEn("");
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.menu.categoryNameAr}</Label>
                  <Input value={newCatAr} onChange={(e) => setNewCatAr(e.target.value)} dir="rtl" />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.menu.categoryNameEn}</Label>
                  <Input value={newCatEn} onChange={(e) => setNewCatEn(e.target.value)} />
                </div>
                <Button onClick={handleAddCategory} className="w-full">{t.save}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={itemDialogOpen} onOpenChange={(open) => { setItemDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="h-4 w-4 me-2" />
                {t.admin.menu.addItem}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? t.admin.menu.editItem : t.admin.menu.addItem}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.itemNameAr}</Label>
                    <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.itemNameEn}</Label>
                    <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.descriptionAr}</Label>
                    <Textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} dir="rtl" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.descriptionEn}</Label>
                    <Textarea value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} rows={2} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.menu.price}</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.menu.category}</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{isArabic ? cat.nameAr : cat.nameEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.menu.image}</Label>
                  <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
                  <Label>{t.admin.menu.availability}: {form.available ? t.admin.menu.inStock : t.admin.menu.outOfStock}</Label>
                </div>
                <Button onClick={handleSaveItem} className="w-full">{t.save}</Button>
              </div>
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
