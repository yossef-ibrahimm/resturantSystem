import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import {
  getInventoryItems,
  getActiveInventoryCategories,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/lib/api";
import { getStockLevel } from "@/lib/inventory-alerts";
import type { InventoryItem } from "@/lib/inventory-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import EmptyState from "@/components/EmptyState";
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UNITS = ["g", "kg", "ml", "l", "pc", "box", "bag", "bottle", "pack"] as const;

const inventoryItemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameEn: z.string().trim().min(1, "English name is required"),
  code: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  unit: z.enum(UNITS),
  minQty: z.coerce.number().min(0).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  recommendedReorderQty: z.coerce.number().min(0).optional(),
});

type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

function getStockStatus(item: InventoryItem): { label: string; color: string } {
  const qty = Number(item.qtyOnHand);
  if (qty === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
  if (qty <= Number(item.minQty)) return { label: "Critical", color: "bg-orange-100 text-orange-700" };
  if (qty <= Number(item.reorderPoint)) return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
  return { label: "In Stock", color: "bg-green-100 text-green-700" };
}

export default function InventoryItemsPage() {
  const { t, isArabic } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      categoryId: "",
      nameAr: "",
      nameEn: "",
      code: "",
      description: "",
      unit: "pc",
      minQty: 0,
      reorderPoint: 0,
      recommendedReorderQty: 0,
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items", categoryFilter, search],
    queryFn: () => getInventoryItems({ categoryId: categoryFilter || undefined, search: search || undefined }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories-active"],
    queryFn: getActiveInventoryCategories,
  });

  const createMut = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-dashboard"] });
      toast.success(isArabic ? "تم إضافة العنصر" : "Item created");
      setDialogOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateInventoryItem>[1] }) =>
      updateInventoryItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast.success(isArabic ? "تم تحديث العنصر" : "Item updated");
      setDialogOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast.success(isArabic ? "تم حذف العنصر" : "Item deleted");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingItem(null);
    reset({
      categoryId: categories[0]?.id || "",
      nameAr: "", nameEn: "", code: "", description: "", unit: "pc",
      minQty: 0, reorderPoint: 0, recommendedReorderQty: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    reset({
      categoryId: item.categoryId,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      code: item.code || "",
      description: item.description,
      unit: item.unit as typeof UNITS[number],
      minQty: Number(item.minQty),
      reorderPoint: Number(item.reorderPoint),
      recommendedReorderQty: Number(item.recommendedReorderQty),
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: InventoryItemFormData) => {
    const payload = {
      categoryId: data.categoryId,
      nameAr: data.nameAr.trim(),
      nameEn: data.nameEn.trim(),
      code: data.code || undefined,
      description: data.description || "",
      unit: data.unit,
      minQty: data.minQty || undefined,
      reorderPoint: data.reorderPoint || undefined,
      recommendedReorderQty: data.recommendedReorderQty || undefined,
    };
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isArabic ? "عناصر المخزون" : "Inventory Items"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isArabic ? "إدارة عناصر المخزون والكميات" : "Manage inventory items and stock levels"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          {isArabic ? "إضافة عنصر" : "Add Item"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={isArabic ? "بحث بالاسم أو الكود..." : "Search by name or code..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{isArabic ? "كل الفئات" : "All Categories"}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {isArabic ? cat.nameAr : cat.nameEn}
            </option>
          ))}
        </select>
      </div>

      {!isLoading && items.length > 0 && (() => {
        const lowItems = items.filter(
          (i) => getStockLevel(Number(i.qtyOnHand), Number(i.minQty), Number(i.reorderPoint)) !== "ok"
        );
        if (lowItems.length === 0) return null;
        return (
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              {isArabic
                ? `${lowItems.length} صنف اقترب مخزونه من النفاد — يُرجى إعادة الطلب`
                : `${lowItems.length} item(s) are running low — please reorder soon`}
            </span>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{t.loading}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={isArabic ? "لا توجد عناصر" : "No Items"}
          description={
            search || categoryFilter
              ? isArabic
                ? "لا توجد نتائج"
                : "No matching items"
              : isArabic
              ? "ابدأ بإضافة عناصر المخزون"
              : "Start by adding inventory items"
          }
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "الاسم" : "Name"}</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الكود" : "Code"}</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden md:table-cell">{isArabic ? "الفئة" : "Category"}</th>
                  <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الوحدة" : "Unit"}</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{isArabic ? item.nameAr : item.nameEn}</p>
                          <p className="text-xs text-muted-foreground truncate sm:hidden">{item.code || "-"}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.code || "-"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                        {item.category ? (isArabic ? item.category.nameAr : item.category.nameEn) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-end font-mono">{Number(item.qtyOnHand)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                          {isArabic
                            ? status.label === "Out of Stock" ? "نفذ" : status.label === "Critical" ? "حرج" : status.label === "Low Stock" ? "منخفض" : "متوفر"
                            : status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? isArabic ? "تعديل العنصر" : "Edit Item"
                : isArabic ? "إضافة عنصر جديد" : "New Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "الفئة" : "Category"} *
              </label>
              <select
                {...register("categoryId")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "اختر فئة" : "Select category"}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {isArabic ? cat.nameAr : cat.nameEn}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-destructive mt-1">{errors.categoryId.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الاسم بالعربي" : "Arabic Name"} *
                </label>
                <Input
                  {...register("nameAr")}
                  aria-invalid={!!errors.nameAr}
                  aria-describedby={errors.nameAr ? "item-nameAr-error" : undefined}
                />
                {errors.nameAr && (
                  <p id="item-nameAr-error" className="text-xs text-destructive mt-1">{errors.nameAr.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الاسم بالانجليزي" : "English Name"} *
                </label>
                <Input
                  {...register("nameEn")}
                  aria-invalid={!!errors.nameEn}
                  aria-describedby={errors.nameEn ? "item-nameEn-error" : undefined}
                />
                {errors.nameEn && (
                  <p id="item-nameEn-error" className="text-xs text-destructive mt-1">{errors.nameEn.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الكود" : "Code / SKU"}
                </label>
                <Input
                  {...register("code")}
                  placeholder="MILK-001"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الوحدة" : "Unit"} *
                </label>
                <select
                  {...register("unit")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الحد الأدنى" : "Min Qty"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("minQty")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "نقطة إعادة الطلب" : "Reorder Point"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("reorderPoint")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "كمية إعادة الطلب" : "Reorder Qty"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("recommendedReorderQty")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingItem ? t.save : t.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirm}</DialogTitle>
          </DialogHeader>
          <p>{isArabic ? "هل أنت متأكد من حذف هذا العنصر؟" : "Are you sure you want to delete this item?"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)}
              disabled={deleteMut.isPending}
            >
              {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
