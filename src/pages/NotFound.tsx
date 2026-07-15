import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ChefHat, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, isArabic } = useLanguage();

  useEffect(() => {
    // Production: no console.error
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-6">
        <div className="bg-muted/50 rounded-full p-6 mx-auto w-fit">
          <ChefHat className="h-12 w-12 text-muted-foreground/40" />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
          <p className="text-xl text-muted-foreground">
            {isArabic ? "عذراً! الصفحة غير موجودة" : "Oops! Page not found"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {isArabic ? "العودة" : "Go Back"}
          </Button>
          <Button asChild>
            <Link to="/">{isArabic ? "الصفحة الرئيسية" : "Return to Home"}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
