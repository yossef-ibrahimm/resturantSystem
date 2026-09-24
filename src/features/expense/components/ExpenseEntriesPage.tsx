import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getActiveMainExpenseCategories,
  getActiveSubExpenseCategories,
  getExpenseSummary,
} from "@/lib/api";
import type { Expense } from "@/lib/expense-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

const expenseSchema = z.object({
  subCategoryId: z.string().min(1, "Sub-category is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  spentAt: z.string().min(1, "Date is required"),
  paymentMethod: z.string().default("cash"),
  description: z.string().trim().min(1, "Description is required"),
  note: z.string().optional().or(z.literal("")),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

const PAYMENT_METHODS = ["cash", "card", "wallet", "other"];

export default function ExpenseEntriesPage() {
  const { isArabic } = useLanguage();
  const queryClient = useQueryClient();

  // ─── State ───
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterMainCat, setFilterMainCat] = useState<string>("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // ─── Form ───
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      subCategoryId: "",
      amount: 0,
      spentAt: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      description: "",
      note: "",
    },
  });

  // ─── Queries ───
  const { data: mainCategories = [] } = useQuery({
    queryKey: ["expense-main-categories-active"],
    queryFn: getActiveMainExpenseCategories,
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ["expense-sub-categories-active"],
    queryFn: () => getActiveSubExpenseCategories(),
  });

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["expenses", filterMainCat, filterPaymentMethod, filterFrom, filterTo, search, page],
    queryFn: () => getExpenses({
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      mainCategoryId: filterMainCat || undefined,
      paymentMethod: filterPaymentMethod || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
      search: search || undefined,
    }),
  });

  const { data: summary } = useQuery({
    queryKey: ["expense-summary", filterFrom, filterTo],
    queryFn: () => getExpenseSummary({
      from: filterFrom || undefined,
      to: filterTo || undefined,
    }),
  });

  const filteredSubCategories = filterMainCat
    ? subCategories.filter((s) => s.mainCategoryId === filterMainCat)
    : subCategories;

  // ─── Mutations ───
  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      toast.success(isArabic ? "تم إضافة المصروف" : "Expense created");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      toast.success(isArabic ? "تم تحديث المصروف" : "Expense updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      toast.success(isArabic ? "تم حذف المصروف" : "Expense deleted");
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Handlers ───
  function closeDialog() {
    setDialogOpen(false);
    setEditingExpense(null);
    form.reset({
      subCategoryId: "",
      amount: 0,
      spentAt: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      description: "",
      note: "",
    });
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setDialogOpen(true);
    form.reset({
      subCategoryId: expense.subCategoryId,
      amount: expense.amount,
      spentAt: expense.spentAt.split("T")[0],
      paymentMethod: expense.paymentMethod,
      description: expense.description,
      note: expense.note || "",
    });
  }

  function onSubmit(data: ExpenseFormData) {
    const payload = {
      ...data,
      note: data.note || undefined,
    };

    if (editingExpense) {
      updateMut.mutate({ id: editingExpense.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function getPaymentMethodLabel(method: string) {
    const labels: Record<string, { ar: string; en: string }> = {
      cash: { ar: "نقدي", en: "Cash" },
      card: { ar: "بطاقة", en: "Card" },
      wallet: { ar: "محفظة", en: "Wallet" },
      other: { ar: "أخرى", en: "Other" },
    };
    return isArabic ? labels[method]?.ar || method : labels[method]?.en || method;
  }

  const expenses = expensesData?.items || [];
  const total = expensesData?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isArabic ? "المصروفات" : "Expenses"}</h1>
          <p className="text-muted-foreground text-sm">
            {isArabic ? "تسجيل ومتابعة المصروفات" : "Record and track expenses"}
          </p>
        </div>
        <Button onClick={() => { setDialogOpen(true); form.reset(); }}>
          <Plus className="mr-2 h-4 w-4" />
          {isArabic ? "مصروف جديد" : "New Expense"}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isArabic ? "إجمالي المصروفات" : "Total Expenses"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(summary.grandTotal)}</div>
              <p className="text-xs text-muted-foreground">{summary.totalCount} {isArabic ? "مصروف" : "entries"}</p>
            </CardContent>
          </Card>
          {summary.byMainCategory.map((cat) => (
            <Card key={cat.mainCategoryId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isArabic ? cat.nameAr : cat.nameEn}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(cat.total)}</div>
                <p className="text-xs text-muted-foreground">{cat.count} {isArabic ? "مصروف" : "entries"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? "بحث" : "Search"}</label>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder={isArabic ? "بحث..." : "Search..."}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? "الفئة الرئيسية" : "Main Category"}</label>
              <select
                value={filterMainCat}
                onChange={(e) => { setFilterMainCat(e.target.value); setPage(0); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                {mainCategories.map((m) => (
                  <option key={m.id} value={m.id}>{isArabic ? m.nameAr : m.nameEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? "طريقة الدفع" : "Payment Method"}</label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => { setFilterPaymentMethod(e.target.value); setPage(0); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{getPaymentMethodLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? "من" : "From"}</label>
              <Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? "إلى" : "To"}</label>
              <Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(0); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt }
          title={isArabic ? "لا توجد مصروفات" : "No expenses"}
          description={isArabic ? "سجّل مصروفاً جديداً للبدء" : "Record a new expense to get started"}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">{isArabic ? "التاريخ" : "Date"}</th>
                    <th className="text-left py-2 px-3">{isArabic ? "الفئة" : "Category"}</th>
                    <th className="text-left py-2 px-3">{isArabic ? "الوصف" : "Description"}</th>
                    <th className="text-left py-2 px-3">{isArabic ? "طريقة الدفع" : "Method"}</th>
                    <th className="text-right py-2 px-3">{isArabic ? "المبلغ" : "Amount"}</th>
                    <th className="text-right py-2 px-3">{isArabic ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">{new Date(expense.spentAt).toLocaleDateString()}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-muted-foreground">
                          {isArabic ? expense.mainCategoryNameAr : expense.mainCategoryNameEn}
                        </span>
                        <br />
                        <span>{isArabic ? expense.subCategoryNameAr : expense.subCategoryNameEn}</span>
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate">{expense.description}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{getPaymentMethodLabel(expense.paymentMethod)}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{formatPrice(expense.amount)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(expense.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {isArabic ? `عرض ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} من ${total}` : `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    {isArabic ? "السابق" : "Previous"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    {isArabic ? "التالي" : "Next"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingExpense
                ? (isArabic ? "تعديل المصروف" : "Edit Expense")
                : (isArabic ? "مصروف جديد" : "New Expense")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{isArabic ? "الفئة الفرعية" : "Sub-Category"}</label>
              <select
                {...form.register("subCategoryId")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "اختر فئة" : "Select category"}</option>
                {filteredSubCategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isArabic ? s.mainCategory?.nameAr : s.mainCategory?.nameEn} &gt; {isArabic ? s.nameAr : s.nameEn}
                  </option>
                ))}
              </select>
              {form.formState.errors.subCategoryId && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.subCategoryId.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{isArabic ? "المبلغ" : "Amount"}</label>
                <Input type="number" step="0.01" {...form.register("amount")} />
                {form.formState.errors.amount && (
                  <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">{isArabic ? "التاريخ" : "Date"}</label>
                <Input type="date" {...form.register("spentAt")} />
                {form.formState.errors.spentAt && (
                  <p className="text-destructive text-xs mt-1">{form.formState.errors.spentAt.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "طريقة الدفع" : "Payment Method"}</label>
              <select
                {...form.register("paymentMethod")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{getPaymentMethodLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "الوصف" : "Description"}</label>
              <Input {...form.register("description")} placeholder={isArabic ? "وصف المصروف" : "Expense description"} />
              {form.formState.errors.description && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{isArabic ? "ملاحظات" : "Notes"}</label>
              <Input {...form.register("note")} placeholder={isArabic ? "ملاحظات اختيارية" : "Optional notes"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingExpense ? (isArabic ? "تحديث" : "Update") : (isArabic ? "إضافة" : "Create")}
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
              ? "هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء."
              : "Are you sure you want to delete this expense? This action cannot be undone."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)}
              disabled={deleteMut.isPending}
            >
              {isArabic ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
