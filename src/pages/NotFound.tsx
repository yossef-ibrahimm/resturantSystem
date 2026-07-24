import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
      <p className="text-lg text-muted-foreground">{t.notFound || "Page not found"}</p>
      <Button asChild>
        <Link to="/">{t.nav?.menu || "Back to menu"}</Link>
      </Button>
    </div>
  );
}
