import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import {
  getMainExpenseCategories,
  createMainExpenseCategory,
  updateMainExpenseCategory,
  deleteMainExpenseCategory,
  getSubExpenseCategories,
  createSubExpenseCategory,
  updateSubExpenseCategory,
  deleteSubExpenseCategory,
} from "@/lib/api";
import type { MainExpenseCategory, SubExpenseCategory } from "@/lib/expense-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const mainCategorySchema = z.object({
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameEn: z.string().trim().min(1, "English name is required"),
  description: z.string().optional().or(z.literal("")),
});

const subCategorySchema = z.object({
  mainCategoryId: z.string().min(1, "Main category is required"),
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameEn: z.string().trim().min(1, "English name is required"),
  description: z.string().optional().or(z.literal("")),
});

type MainFormData = z.infer<typeof mainCategorySchema>;
type SubFormData = z.infer<typeof subCategorySchema>;

export default function ExpenseCategoriesPage() {
  const { isArabic } = useLanguage();
  const queryClient = useQueryClient();

  // ─── State ───
  const [dialogType, setDialogType] = useState<"main" | "sub" | null>(null);
  const [editingMain, setEditingMain] = useState<MainExpenseCategory | null>(null);
  const [editingSub, setEditingSub] = useState<SubExpenseCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "main" | "sub"; id: string } | null>(null);
  const [expandedMain, setExpandedMain] = useState<Set<string>>(new Set());

  // ─── Forms ───
  const mainForm = useForm<MainFormData>({
    resolver: zodResolver(mainCategorySchema),
    defaultValues: { nameAr: "", nameEn: "", description: "" },
  });

  const subForm = useForm<SubFormData>({
    resolver: zodResolver(subCategorySchema),
    defaultValues: { mainCategoryId: "", nameAr: "", nameEn: "", description: "" },
  });

  // ─── Queries ───
  const { data: mainCategories = [], isLoading } = useQuery({
    queryKey: ["expense-main-categories"],
    queryFn: getMainExpenseCategories,
  });

  const { data: allSubCategories = [] } = useQuery({
    queryKey: ["expense-sub-categories"],
    queryFn: () => getSubExpenseCategories(),
  });

  // ─── Mutations ───
  const createMainMut = useMutation({
    mutationFn: createMainExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      toast.success(isArabic ? "تم إضافة الفئة الرئيسية" : "Main category created");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMainMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMainExpenseCategory>[1] }) =>
      updateMainExpenseCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      toast.success(isArabic ? "تم تحديث الفئة الرئيسية" : "Main category updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMainMut = useMutation({
    mutationFn: deleteMainExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      toast.success(isArabic ? "تم حذف الفئة الرئيسية" : "Main category deleted");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSubMut = useMutation({
    mutationFn: createSubExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-sub-categories"] });
      toast.success(isArabic ? "تم إضافة الفئة الفرعية" : "Sub-category created");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSubExpenseCategory>[1] }) =>
      updateSubExpenseCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-sub-categories"] });
      toast.success(isArabic ? "تم تحديث الفئة الفرعية" : "Sub-category updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSubMut = useMutation({
    mutationFn: deleteSubExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-main-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expense-sub-categories"] });
      toast.success(isArabic ? "تم حذف الفئة الفرعية" : "Sub-category deleted");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Handlers ───
  function closeDialog() {
    setDialogType(null);
    setEditingMain(null);
    setEditingSub(null);
    mainForm.reset();
    subForm.reset();
  }

  function openEditMain(cat: MainExpenseCategory) {
    setEditingMain(cat);
    setDialogType("main");
    mainForm.reset({ nameAr: cat.nameAr, nameEn: cat.nameEn, description: cat.description || "" });
  }

  function openEditSub(cat: SubExpenseCategory) {
    setEditingSub(cat);
    setDialogType("sub");
    subForm.reset({ mainCategoryId: cat.mainCategoryId, nameAr: cat.nameAr, nameEn: cat.nameEn, description: cat.description || "" });
  }

  function onSubmitMain(data: MainFormData) {
    if (editingMain) {
      updateMainMut.mutate({ id: editingMain.id, data });
    } else {
      createMainMut.mutate(data);
    }
  }

  function onSubmitSub(data: SubFormData) {
    if (editingSub) {
      updateSubMut.mutate({ id: editingSub.id, data });
    } else {
      createSubMut.mutate(data);
    }
  }

  function toggleExpand(mainId: string) {
    setExpandedMain((prev) => {
      const next = new Set(prev);
      if (next.has(mainId)) next.delete(mainId);
      else next.add(mainId);
      return next;
    });
  }

  // ─── Render ───
  if (isLoading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isArabic ? "فئات المصروفات" : "Expense Categories"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isArabic ? "إدارة الفئات الرئيسية والفرعية" : "Manage main and sub expense categories"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setDialogType("main"); mainForm.reset(); }}>
            <Plus className="mr-2 h-4 w-4" />
            {isArabic ? "فئة رئيسية" : "Main Category"}
          </Button>
          <Button variant="outline" onClick={() => { setDialogType("sub"); subForm.reset(); }}>
            <Plus className="mr-2 h-4 w-4" />
            {isArabic ? "فئة فرعية" : "Sub-Category"}
          </Button>
        </div>
      </div>

      {/* Categories Tree */}
      {mainCategories.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-12 w-12" />}
          title={isArabic ? "لا توجد فئات" : "No categories"}
          description={isArabic ? "أضف فئة رئيسية للبدء" : "Add a main category to get started"}
        />
      ) : (
        <div className="space-y-3">
          {mainCategories.map((mainCat) => {
            const isExpanded = expandedMain.has(mainCat.id);
            const subs = mainCat.subCategories || allSubCategories.filter((s) => s.mainCategoryId === mainCat.id);

            return (
              <Card key={mainCat.id}>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
                  onClick={() => toggleExpand(mainCat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle className="text-base">
                        {isArabic ? mainCat.nameAr : mainCat.nameEn}
                      </CardTitle>
                      <Badge variant={mainCat.active ? "default" : "secondary"}>
                        {mainCat.active ? (isArabic ? "نشط" : "Active") : (isArabic ? "غير نشط" : "Inactive")}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {subs.length} {isArabic ? "فئات فرعية" : "sub-categories"}
                      </span>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEditMain(mainCat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: "main", id: mainCat.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {subs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        {isArabic ? "لا توجد فئات فرعية" : "No sub-categories"}
                      </p>
                    ) : (
                      <div className="space-y-1 ml-7">
                        {subs.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <span>{isArabic ? sub.nameAr : sub.nameEn}</span>
                              <Badge variant={sub.active ? "default" : "secondary"} className="text-xs">
                                {sub.active ? (isArabic ? "نشط" : "Active") : (isArabic ? "غير نشط" : "Inactive")}
                              </Badge>
                              {sub._count && sub._count.expenses > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {sub._count.expenses} {isArabic ? "مصروف" : "entries"}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditSub(sub)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: "sub", id: sub.id })}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Main Category Dialog */}
      <Dialog open={dialogType === "main"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMain
                ? (isArabic ? "تعديل الفئة الرئيسية" : "Edit Main Category")
                : (isArabic ? "إضافة فئة رئيسية" : "Add Main Category")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={mainForm.handleSubmit(onSubmitMain)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{isArabic ? "الاسم بالعربي" : "Arabic Name"}</label>
              <Input {...mainForm.register("nameAr")} placeholder={isArabic ? "مثال: مصروفات ثابتة" : "e.g. Fixed Expenses"} />
              {mainForm.formState.errors.nameAr && (
                <p className="text-destructive text-xs mt-1">{mainForm.formState.errors.nameAr.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الاسم بالإنجليزي" : "English Name"}</label>
              <Input {...mainForm.register("nameEn")} placeholder="e.g. Fixed Expenses" />
              {mainForm.formState.errors.nameEn && (
                <p className="text-destructive text-xs mt-1">{mainForm.formState.errors.nameEn.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الوصف" : "Description"}</label>
              <Input {...mainForm.register("description")} placeholder={isArabic ? "وصف اختياري" : "Optional description"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button type="submit" disabled={createMainMut.isPending || updateMainMut.isPending}>
                {editingMain ? (isArabic ? "تحديث" : "Update") : (isArabic ? "إضافة" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sub Category Dialog */}
      <Dialog open={dialogType === "sub"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSub
                ? (isArabic ? "تعديل الفئة الفرعية" : "Edit Sub-Category")
                : (isArabic ? "إضافة فئة فرعية" : "Add Sub-Category")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={subForm.handleSubmit(onSubmitSub)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{isArabic ? "الفئة الرئيسية" : "Main Category"}</label>
              <select
                {...subForm.register("mainCategoryId")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "اختر فئة رئيسية" : "Select main category"}</option>
                {mainCategories.filter((m) => m.active).map((m) => (
                  <option key={m.id} value={m.id}>{isArabic ? m.nameAr : m.nameEn}</option>
                ))}
              </select>
              {subForm.formState.errors.mainCategoryId && (
                <p className="text-destructive text-xs mt-1">{subForm.formState.errors.mainCategoryId.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الاسم بالعربي" : "Arabic Name"}</label>
              <Input {...subForm.register("nameAr")} placeholder={isArabic ? "مثال: إيجار" : "e.g. Rent"} />
              {subForm.formState.errors.nameAr && (
                <p className="text-destructive text-xs mt-1">{subForm.formState.errors.nameAr.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الاسم بالإنجليزي" : "English Name"}</label>
              <Input {...subForm.register("nameEn")} placeholder="e.g. Rent" />
              {subForm.formState.errors.nameEn && (
                <p className="text-destructive text-xs mt-1">{subForm.formState.errors.nameEn.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الوصف" : "Description"}</label>
              <Input {...subForm.register("description")} placeholder={isArabic ? "وصف اختياري" : "Optional description"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button type="submit" disabled={createSubMut.isPending || updateSubMut.isPending}>
                {editingSub ? (isArabic ? "تحديث" : "Update") : (isArabic ? "إضافة" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "هل أنت متأكد من حذف هذه الفئة؟ لا يمكن التراجع عن هذا الإجراء."
              : "Are you sure you want to delete this category? This action cannot be undone."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "main") deleteMainMut.mutate(deleteConfirm.id);
                else deleteSubMut.mutate(deleteConfirm.id);
              }}
              disabled={deleteMainMut.isPending || deleteSubMut.isPending}
            >
              {isArabic ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
