import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { getUsers, createUser, toggleUserActive, deleteUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "kitchen_staff", "waiter", "cashier"]),
});

type StaffFormData = z.infer<typeof staffSchema>;

export default function StaffManagement() {
  const { t, isArabic } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: "", email: "", role: "kitchen_staff" },
  });

  const loadUsers = useCallback(async () => {
    try {
      const u = await getUsers();
      setUsers(u);
      setLoading(false);
      setError(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (data: StaffFormData) => {
    try {
      const created = await createUser({ name: data.name, email: data.email, role: data.role });
      toast.success(isArabic ? "تمت إضافة الموظف" : "Staff member added");
      setDialogOpen(false);
      reset();
      setCreatedPassword(created.temporaryPassword);
      setCreatedName(created.name);
      loadUsers();
    } catch {
      toast.error(t.error);
    }
  };

  const handleToggle = async (id: string, currentName: string) => {
    if (!confirm(isArabic ? `هل تريد تغيير حالة ${currentName}؟` : `Toggle status for ${currentName}?`)) return;
    try {
      await toggleUserActive(id);
      toast.success(isArabic ? "تم تحديث الحالة" : "Status updated");
      loadUsers();
    } catch {
      toast.error(t.error);
    }
  };

  const handleDelete = async (id: string, currentName: string) => {
    if (!confirm(isArabic ? `هل تريد حذف ${currentName}؟` : `Delete ${currentName}?`)) return;
    try {
      await deleteUser(id);
      toast.success(isArabic ? "تم حذف الموظف" : "Staff member deleted");
      loadUsers();
    } catch {
      toast.error(t.error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg mb-4">{t.error}</p>
        <Button onClick={loadUsers}>{t.retry}</Button>
      </div>
    );
  }

  const watchedRole = watch("role");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.admin.staffManagement}</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 me-2" />
              {t.admin.staff.addStaff}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.admin.staff.addStaff}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.admin.staff.name}</Label>
                <Input {...register("name")} aria-label={t.admin.staff.name} />
                {errors.name && <p className="text-xs text-destructive">{isArabic ? "مطلوب" : "Required"}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t.admin.staff.email}</Label>
                <Input type="email" {...register("email")} aria-label={t.admin.staff.email} />
                {errors.email && <p className="text-xs text-destructive">{isArabic ? "بريد غير صالح" : "Invalid email"}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t.admin.staff.role}</Label>
                <Select value={watchedRole} onValueChange={(v) => setValue("role", v as "admin" | "kitchen_staff" | "waiter" | "cashier")}>
                  <SelectTrigger aria-label={t.admin.staff.role}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{isArabic ? "مدير" : "Admin"}</SelectItem>
                    <SelectItem value="kitchen_staff">{isArabic ? "موظف مطبخ" : "Kitchen Staff"}</SelectItem>
                    <SelectItem value="waiter">{isArabic ? "جرسون" : "Waiter"}</SelectItem>
                    <SelectItem value="cashier">{isArabic ? "كاشير" : "Cashier"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">{t.save}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{isArabic ? "لا يوجد موظفين" : "No staff members"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{user.name}</span>
                    <Badge variant={user.active ? "default" : "destructive"}>
                      {user.active ? t.admin.staff.active : t.admin.staff.inactive}
                    </Badge>
                    <Badge variant="outline">
                      {user.role === "admin"
                        ? (isArabic ? "مدير" : "Admin")
                        : user.role === "waiter"
                          ? (isArabic ? "جرسون" : "Waiter")
                          : user.role === "cashier"
                            ? (isArabic ? "كاشير" : "Cashier")
                            : (isArabic ? "مطبخ" : "Kitchen")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={user.active ? (isArabic ? "تعطيل" : "Deactivate") : (isArabic ? "تفعيل" : "Activate")}
                    onClick={() => handleToggle(user.id, user.name)}
                  >
                    {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={isArabic ? "حذف" : "Delete"}
                    onClick={() => handleDelete(user.id, user.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createdPassword !== null} onOpenChange={(open) => { if (!open) setCreatedPassword(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? "كلمة مرور مؤقتة" : "Temporary Password"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isArabic
                ? `تم إنشاء حساب ${createdName}. شارك كلمة المرور المؤقتة مرة واحدة فقط — سيُطلب منه تغييرها عند أول تسجيل دخول.`
                : `Account for ${createdName} created. Share this temporary password once — they will be forced to change it on first login.`}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <code className="flex-1 font-mono text-sm font-bold tracking-wide">{createdPassword}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (createdPassword) navigator.clipboard.writeText(createdPassword);
                  toast.success(isArabic ? "تم النسخ" : "Copied");
                }}
              >
                {isArabic ? "نسخ" : "Copy"}
              </Button>
            </div>
            <Button className="w-full" onClick={() => setCreatedPassword(null)}>
              {t.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
