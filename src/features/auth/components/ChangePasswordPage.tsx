import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { useAuthStore } from "@/stores/authStore";
import { changePassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, LogOut, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 8;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: "New password must be different from the current one",
  path: ["newPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

const ROLE_HOME_ROUTE: Record<string, string> = {
  kitchen_staff: "/kitchen",
  waiter: "/waiter",
};

export default function ChangePasswordPage() {
  const { t, isArabic } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const onSubmit = async (data: ChangePasswordFormData) => {
    setLoading(true);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      setUser({ ...user, mustChangePassword: false });
      toast.success(isArabic ? "تم تغيير كلمة المرور" : "Password changed");
      navigate(ROLE_HOME_ROUTE[user.role] ?? "/admin", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("Current")
          ? isArabic ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect"
          : isArabic ? "فشل تغيير كلمة المرور" : "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordType = showPasswords ? "text" : "password";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isArabic ? "تغيير كلمة المرور" : "Change Password"}
          </CardTitle>
          <CardDescription>
            {isArabic
              ? "يجب تغيير كلمة المرور المؤقتة قبل المتابعة"
              : "You must change your temporary password to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {isArabic ? "كلمة المرور الحالية" : "Current password"}
              </Label>
              <Input
                id="current-password"
                type={passwordType}
                autoComplete="current-password"
                {...register("currentPassword")}
                placeholder="••••••••"
                disabled={loading}
                aria-invalid={!!errors.currentPassword}
                aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
              />
              {errors.currentPassword && (
                <p id="current-password-error" className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                {isArabic ? "كلمة المرور الجديدة" : "New password"}
              </Label>
              <Input
                id="new-password"
                type={passwordType}
                autoComplete="new-password"
                {...register("newPassword")}
                placeholder="••••••••"
                disabled={loading}
                aria-invalid={!!errors.newPassword}
                aria-describedby={errors.newPassword ? "new-password-error" : undefined}
              />
              {errors.newPassword && (
                <p id="new-password-error" className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
              </Label>
              <Input
                id="confirm-password"
                type={passwordType}
                autoComplete="new-password"
                {...register("confirmPassword")}
                placeholder="••••••••"
                disabled={loading}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
              />
              {errors.confirmPassword && (
                <p id="confirm-password-error" className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
              />
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {isArabic ? "إظهار كلمات المرور" : "Show passwords"}
            </label>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t.loading : isArabic ? "تغيير كلمة المرور" : "Change password"}
            </Button>
          </form>
          <Button variant="ghost" className="w-full mt-4 gap-2" onClick={logout} disabled={loading}>
            <LogOut className="h-4 w-4" />
            {isArabic ? "تسجيل الخروج" : "Log out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
