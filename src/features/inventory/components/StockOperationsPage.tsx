import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import {
  getInventoryItems,
  addStock,
  deductStock,
  adjustStock,
  getStockMovements,
} from "@/lib/api";
import type { InventoryItem } from "@/lib/inventory-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import {
  Plus, Minus, Settings, History, Package, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStockLevel, notifyLowStock } from "@/lib/inventory-alerts";

const MOVEMENT_TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  initial: { ar: "جرد أولي", en: "Opening", color: "bg-blue-100 text-blue-700" },
  purchase: { ar: "مشتريات", en: "Purchase", color: "bg-green-100 text-green-700" },
  sale: { ar: "بيع", en: "Sale", color: "bg-purple-100 text-purple-700" },
  consumption: { ar: "استهلاك", en: "Consumption", color: "bg-orange-100 text-orange-700" },
  waste: { ar: "هالك", en: "Waste", color: "bg-red-100 text-red-700" },
  damage: { ar: "تلف", en: "Damage", color: "bg-red-100 text-red-700" },
  expired: { ar: "منتهي الصلاحية", en: "Expired", color: "bg-red-100 text-red-700" },
  adjustment_up: { ar: "زيادة", en: "Adjustment +", color: "bg-green-100 text-green-700" },
  adjustment_down: { ar: "نقص", en: "Adjustment -", color: "bg-yellow-100 text-yellow-700" },
  return: { ar: "مرتجع", en: "Return", color: "bg-blue-100 text-blue-700" },
};

type OperationType = "add" | "deduct" | "adjust";

export default function StockOperationsPage() {
  const { t, isArabic } = useLanguage();
  const queryClient = useQueryClient();
  const [operation, setOperation] = useState<OperationType>("add");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementsDialog, setMovementsDialog] = useState<string | null>(null);
  const [form, setForm] = useState({
    quantity: "",
    unitCost: "",
    reason: "",
    note: "",
    newQuantity: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => getInventoryItems(),
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements", movementsDialog],
    queryFn: () => getStockMovements(movementsDialog!, { take: 50 }),
    enabled: !!movementsDialog,
  });

  const stockMut = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("No item selected");
      const qty = parseFloat(form.quantity);
      if (!qty || qty <= 0) throw new Error("Invalid quantity");

      switch (operation) {
        case "add":
          return addStock({
            inventoryItemId: selectedItem.id,
            quantity: qty,
            unit: selectedItem.unit,
            reason: form.reason || undefined,
            note: form.note || undefined,
            unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
          });
        case "deduct":
          if (qty > Number(selectedItem.qtyOnHand)) {
            throw new Error(
              isArabic
                ? "الكمية المراد خصمها أكبر من المتاح في المخزون"
                : "Deduct quantity exceeds available stock"
            );
          }
          return deductStock({
            inventoryItemId: selectedItem.id,
            quantity: qty,
            unit: selectedItem.unit,
            reason: form.reason || undefined,
            note: form.note || undefined,
          });
        case "adjust": {
          const newQty = parseFloat(form.newQuantity);
          if (!Number.isFinite(newQty) || newQty < 0) {
            throw new Error(isArabic ? "الكمية الفعلية غير صالحة" : "Invalid actual quantity");
          }
          if (!form.reason.trim()) {
            throw new Error(isArabic ? "السبب مطلوب" : "Reason is required");
          }
          return adjustStock({
            inventoryItemId: selectedItem.id,
            newQuantity: newQty,
            reason: form.reason,
            note: form.note || undefined,
          });
        }
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-dashboard"] });
      toast.success(
        isArabic
          ? "تم تحديث المخزون بنجاح"
          : "Stock updated successfully"
      );
      if (selectedItem && result?.newQty !== undefined) {
        const level = getStockLevel(
          result.newQty,
          Number(selectedItem.minQty),
          Number(selectedItem.reorderPoint)
        );
        if (level !== "ok") {
          notifyLowStock(
            isArabic ? selectedItem.nameAr : selectedItem.nameEn,
            result.newQty,
            selectedItem.unit,
            level,
            isArabic
          );
        }
      }
      setDialogOpen(false);
      setSelectedItem(null);
      setForm({ quantity: "", unitCost: "", reason: "", note: "", newQuantity: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openOperation = (type: OperationType, item?: InventoryItem) => {
    setOperation(type);
    setSelectedItem(item || null);
    setForm({ quantity: "", unitCost: "", reason: "", note: "", newQuantity: "" });
    setDialogOpen(true);
  };

  const getTitle = () => {
    const titles: Record<OperationType, { ar: string; en: string }> = {
      add: { ar: "إضافة مخزون", en: "Add Stock" },
      deduct: { ar: "خصم مخزون", en: "Deduct Stock" },
      adjust: { ar: "تعديل المخزون", en: "Adjust Stock" },
    };
    return isArabic ? titles[operation].ar : titles[operation].en;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isArabic ? "حركات المخزون" : "Stock Operations"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isArabic ? "إضافة وخصم وتعديل المخزون" : "Add, deduct, and adjust stock"}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          { type: "add" as const, icon: ArrowUpCircle, color: "text-green-600", bg: "bg-green-50" },
          { type: "deduct" as const, icon: ArrowDownCircle, color: "text-red-600", bg: "bg-red-50" },
          { type: "adjust" as const, icon: Settings, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(({ type, icon: Icon, color, bg }) => (
          <Card
            key={type}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => openOperation(type)}
          >
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <div className={cn("rounded-lg p-2 sm:p-3", bg)}>
                <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", color)} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base">
                  {type === "add"
                    ? isArabic ? "إضافة مخزون" : "Add Stock"
                    : type === "deduct"
                    ? isArabic ? "خصم مخزون" : "Deduct Stock"
                    : isArabic ? "تعديل المخزون" : "Adjust Stock"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {type === "add"
                    ? isArabic ? "استلام مشتريات أو إضافة يدوية" : "Receive purchases or manual add"
                    : type === "deduct"
                    ? isArabic ? "هالك أو تلف أو استخدام" : "Waste, damage, or manual use"
                    : isArabic ? "تصحيح الكمية الفعلية" : "Correct to actual count"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "عناصر المخزون" : "Inventory Items"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">{t.loading}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={isArabic ? "لا توجد عناصر" : "No Items"}
              description={isArabic ? "أضف عناصر المخزون أولاً" : "Add inventory items first"}
            />
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{isArabic ? "العنصر" : "Item"}</th>
                      <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "الكمية" : "Qty"}</th>
                      <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap hidden sm:table-cell">{isArabic ? "الوحدة" : "Unit"}</th>
                      <th className="px-3 py-2.5 text-end font-medium whitespace-nowrap">{isArabic ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{isArabic ? item.nameAr : item.nameEn}</p>
                          {item.code && <p className="text-xs text-muted-foreground">{item.code}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono">{Number(item.qtyOnHand)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                        <td className="px-3 py-2.5 text-end">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openOperation("add", item)}>
                              <Plus className="me-1 h-3 w-3" />
                              <span className="hidden xs:inline">{isArabic ? "إضافة" : "Add"}</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openOperation("deduct", item)}>
                              <Minus className="me-1 h-3 w-3" />
                              <span className="hidden xs:inline">{isArabic ? "خصم" : "Deduct"}</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMovementsDialog(item.id)}>
                              <History className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Operation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">
                {isArabic ? selectedItem.nameAr : selectedItem.nameEn}
              </p>
              <p className="mt-1 text-muted-foreground">
                {isArabic ? "الصنف" : "Category"}:{" "}
                {selectedItem.category
                  ? isArabic
                    ? selectedItem.category.nameAr
                    : selectedItem.category.nameEn
                  : "-"}{" "}
                • {isArabic ? "الوحدة" : "Unit"}: {selectedItem.unit} •{" "}
                {isArabic ? "الحالي" : "Current"}: {Number(selectedItem.qtyOnHand)}{" "}
                {selectedItem.unit}
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "العنصر" : "Item"} *
              </label>
              <select
                value={selectedItem?.id || ""}
                onChange={(e) => {
                  const item = items.find((i) => i.id === e.target.value);
                  setSelectedItem(item || null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isArabic ? "اختر عنصر" : "Select item"}</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {isArabic ? item.nameAr : item.nameEn} — {isArabic ? "الحالي" : "Current"}: {Number(item.qtyOnHand)} {item.unit}
                  </option>
                ))}
              </select>
            </div>

            {operation === "adjust" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الكمية الفعلية" : "Actual Quantity"} *
                </label>
                <Input
                  type="number"
                  value={form.newQuantity}
                  onChange={(e) => setForm({ ...form, newQuantity: e.target.value })}
                  placeholder="0"
                />
                {selectedItem && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isArabic ? "النظام:" : "System:"} {Number(selectedItem.qtyOnHand)} {selectedItem.unit} →{" "}
                    {isArabic ? "الفرق:" : "Diff:"}{" "}
                    {form.newQuantity
                      ? parseFloat(form.newQuantity) - Number(selectedItem.qtyOnHand)
                      : 0}{" "}
                    {selectedItem.unit}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "الكمية" : "Quantity"} *
                </label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}

            {operation === "add" && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "تكلفة الوحدة" : "Unit Cost"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}

            {operation === "adjust" && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {isArabic ? "السبب" : "Reason"} *
                </label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder={isArabic ? "مثال: جرد fiz" : "e.g., Physical count correction"}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "السبب" : "Reason"}
                {operation === "deduct" ? " *" : ""}
              </label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={
                  isArabic
                    ? "مثال: استخدام للمطبخ أو تالف"
                    : "e.g., Kitchen use or damaged"
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {isArabic ? "ملاحظات" : "Notes"}
              </label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => stockMut.mutate()}
              disabled={
                stockMut.isPending ||
                !selectedItem ||
                (operation === "adjust" && (!form.reason.trim())) ||
                (operation === "deduct" && !form.reason.trim())
              }
            >
              {isArabic ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movements History Dialog */}
      <Dialog open={!!movementsDialog} onOpenChange={() => setMovementsDialog(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isArabic ? "سجل الحركات" : "Movement History"}</DialogTitle>
          </DialogHeader>
          {movementsLoading ? (
            <div className="py-8 text-center text-muted-foreground">{t.loading}</div>
          ) : movementsData?.movements.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {isArabic ? "لا توجد حركات" : "No movements recorded"}
            </p>
          ) : (
            <div className="space-y-2">
              {movementsData?.movements.map((mov) => {
                const typeInfo = MOVEMENT_TYPE_LABELS[mov.type] || { ar: mov.type, en: mov.type, color: "bg-gray-100" };
                return (
                  <div key={mov.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={cn(typeInfo.color, "shrink-0")} variant="secondary">
                        {isArabic ? typeInfo.ar : typeInfo.en}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {mov.quantity > 0 ? "+" : ""}{mov.quantity} {mov.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isArabic ? "قبل:" : "Before:"} {mov.qtyBefore} → {isArabic ? "بعد:" : "After:"} {mov.qtyAfter}
                        </p>
                      </div>
                    </div>
                    <div className="text-end shrink-0 ms-2">
                      {mov.reason && <p className="text-xs text-muted-foreground">{mov.reason}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(mov.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
