import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import {
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
} from "@/lib/api";
import type { InventoryCategory } from "@/lib/inventory-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { Plus, Pencil, Trash2, Search, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const categorySchema = z.object({
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameEn: z.string().trim().min(1, "English name is required"),
  description: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function InventoryCategoriesPage() {
  const { t, isArabic } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<InventoryCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { nameAr: "", nameEn: "", description: "", sortOrder: 0 },
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: getInventoryCategories,
  });

  const createMut = useMutation({
    mutationFn: createInventoryCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success(isArabic ? "تم إضافة الفئة" : "Category created");
      setDialogOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateInventoryCategory>[1] }) =>
      updateInventoryCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success(isArabic ? "تم تحديث الفئة" : "Category updated");
      setDialogOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteInventoryCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success(isArabic ? "تم حذف الفئة" : "Category deleted");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingCat(null);
    reset({ nameAr: "", nameEn: "", description: "", sortOrder: 0 });
    setDialogOpen(true);
  };

  const openEdit = (cat: InventoryCategory) => {
    setEditingCat(cat);
    reset({ nameAr: cat.nameAr, nameEn: cat.nameEn, description: cat.description, sortOrder: cat.sortOrder });
    setDialogOpen(true);
  };

  const onSubmit = (data: CategoryFormData) => {
    if (editingCat) {
      updateMut.mutate({ id: editingCat.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  const filtered = categories.filter(
    (c) =>
      c.nameAr.includes(search) ||
      c.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isArabic ? "فئات المخزون" : "Inventory Categories"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isArabic ? "إدارة فئات عناصر المخزون" : "Manage inventory item categories"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          {isArabic ? "إضافة فئة" : "Add Category"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={isArabic ? "بحث..." : "Search..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{t.loading}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={isArabic ? "لا توجد فئات" : "No Categories"}
          description={
            search
              ? isArabic
                ? "لا توجد نتائج للبحث"
                : "No matching categories"
              : isArabic
              ? "ابدأ بإضافة فئات المخزون"
              : "Start by adding inventory categories"
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{cat.nameEn}</CardTitle>
                  <Badge variant={cat.active ? "default" : "secondary"}>
                    {cat.active
                      ? isArabic ? "نشط" : "Active"
                      : isArabic ? "غير نشط" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{cat.nameAr}</p>
              </CardHeader>
              <CardContent>
                {cat.description && (
                  <p className="mb-2 text-sm text-muted-foreground">{cat.description}</p>
                )}
                <p className="mb-3 text-xs text-muted-foreground">
                  {cat._count?.items ?? 0} {isArabic ? "عناصر" : "items"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>
                    <Pencil className="me-1 h-3 w-3" />
                    {t.edit}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(cat.id)}
                  >
                    <Trash2 className="me-1 h-3 w-3" />
                    {t.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCat
                ? isArabic ? "تعديل الفئة" : "Edit Category"
                : isArabic ? "إضافة فئة جديدة" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "الاسم بالعربي" : "Arabic Name"} *
              </label>
              <Input
                {...register("nameAr")}
                placeholder={isArabic ? "مثال: ألبان" : "e.g., Dairy"}
                aria-invalid={!!errors.nameAr}
                aria-describedby={errors.nameAr ? "cat-nameAr-error" : undefined}
              />
              {errors.nameAr && (
                <p id="cat-nameAr-error" className="text-xs text-destructive mt-1">{errors.nameAr.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "الاسم بالانجليزي" : "English Name"} *
              </label>
              <Input
                {...register("nameEn")}
                placeholder={isArabic ? "مثال: Dairy" : "e.g., Dairy"}
                aria-invalid={!!errors.nameEn}
                aria-describedby={errors.nameEn ? "cat-nameEn-error" : undefined}
              />
              {errors.nameEn && (
                <p id="cat-nameEn-error" className="text-xs text-destructive mt-1">{errors.nameEn.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "الوصف" : "Description"}
              </label>
              <Input {...register("description")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "ترتيب العرض" : "Sort Order"}
              </label>
              <Input
                type="number"
                {...register("sortOrder")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingCat ? t.save : t.add}
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
          <p>{isArabic ? "هل أنت متأكد من حذف هذه الفئة؟" : "Are you sure you want to delete this category?"}</p>
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
