import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";

interface ReportErrorStateProps {
  onRetry: () => void;
}

export default function ReportErrorState({ onRetry }: ReportErrorStateProps) {
  const { isArabic } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold">{isArabic ? "تعذر تحميل التقرير" : "Unable to load report"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isArabic ? "تحقق من الاتصال وحاول مرة أخرى" : "Check your connection and try again"}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        {isArabic ? "إعادة المحاولة" : "Try again"}
      </Button>
    </div>
  );
}
