import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";
import { getUsers, createUser, toggleUserActive, deleteUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";

export default function StaffManagement() {
  const { t, isArabic } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "kitchen_staff" as "admin" | "kitchen_staff" });

  const loadUsers = async () => {
    try {
      const u = await getUsers();
      setUsers(u);
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    try {
      await createUser({ name: form.name, email: form.email, role: form.role });
      toast.success(isArabic ? "تمت إضافة الموظف" : "Staff member added");
      setDialogOpen(false);
      setForm({ name: "", email: "", role: "kitchen_staff" });
      loadUsers();
    } catch {
      toast.error(t.error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleUserActive(id);
      toast.success(isArabic ? "تم تحديث الحالة" : "Status updated");
      loadUsers();
    } catch {
      toast.error(t.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.admin.staff.deleteConfirm)) return;
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
        <Button onClick={() => window.location.reload()}>{t.retry}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.admin.staffManagement}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.admin.staff.name}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.admin.staff.email}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.admin.staff.role}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "kitchen_staff" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{isArabic ? "مدير" : "Admin"}</SelectItem>
                    <SelectItem value="kitchen_staff">{isArabic ? "موظف مطبخ" : "Kitchen Staff"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full">{t.save}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  <Badge variant={user.active ? "default" : "destructive"}>
                    {user.active ? t.admin.staff.active : t.admin.staff.inactive}
                  </Badge>
                  <Badge variant="outline">
                    {user.role === "admin" ? (isArabic ? "مدير" : "Admin") : (isArabic ? "مطبخ" : "Kitchen")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleToggle(user.id)}>
                  {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(user.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
