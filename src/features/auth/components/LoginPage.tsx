import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { useAuthStore } from "@/stores/authStore";
import { login as apiLogin } from "@/lib/api";
import { useSettingsQuery } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { t, isArabic } = useLanguage();
  const { setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: settings } = useSettingsQuery();

  const restaurantName = isArabic
    ? (settings?.nameAr || t.appName)
    : (settings?.nameEn || t.appName);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const from = location.state?.from || "/admin";

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    setLoading(true);

    try {
      const { user } = await apiLogin(data.email.trim(), data.password);
      if (user) {
        setUser(user);
        if (user.mustChangePassword) {
          toast.info(isArabic ? "يرجى تغيير كلمة المرور المؤقتة" : "Please change your temporary password");
          navigate("/change-password", { replace: true });
          return;
        }
        toast.success(isArabic ? `مرحباً، ${user.name}` : `Welcome, ${user.name}`);
        if (user.role === "kitchen_staff") {
          navigate("/kitchen");
        } else if (user.role === "waiter") {
          navigate("/waiter");
        } else {
          navigate(from);
        }
      } else {
        setError(isArabic ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("401") || message.includes("Invalid")) {
        setError(isArabic ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password");
      } else if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        setError(isArabic ? "تعذر الاتصال بالخادم. تحقق من اتصالك بالشبكة" : "Cannot reach the server. Check your network connection");
      } else {
        setError(isArabic ? "حدث خطأ غير متوقع" : "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={restaurantName} className="h-9 w-auto" />
            ) : (
              <UtensilsCrossed className="h-7 w-7 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{t.admin.login.title}</CardTitle>
          <CardDescription>{t.admin.login.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.admin.login.email}</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.admin.login.password}</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t.loading : t.admin.login.loginBtn}
            </Button>
          </form>
          <Button variant="ghost" className="w-full mt-4" asChild>
            <Link to="/">{isArabic ? "العودة للقائمة" : "Back to Menu"}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
