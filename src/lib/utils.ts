import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, locale: "ar" | "en" | string = "ar"): string {
  const isAr = locale === "ar";
  const symbol = isAr ? "ج.م" : "EGP";
  return `${(price ?? 0).toLocaleString(isAr ? "ar-EG" : "en-US")} ${symbol}`;
}

export function formatDate(dateString: string, locale: "ar" | "en" | string = "ar"): string {
  const isAr = locale === "ar";
  const date = new Date(dateString);
  return date.toLocaleString(isAr ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export function timeAgo(dateString: string, locale: "ar" | "en" | string = "ar"): string {
  const isAr = locale === "ar";
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return isAr ? "الآن" : "Just now";
  if (diffMin < 60) {
    return isAr ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return isAr ? `منذ ${diffH} ساعة` : `${diffH}h ago`;
  }
  const diffD = Math.floor(diffH / 24);
  return isAr ? `منذ ${diffD} يوم` : `${diffD}d ago`;
}

export function getElapsedMinutes(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export function formatElapsed(minutes: number, language: string): string {
  if (minutes < 1) return language === "ar" ? "الآن" : "Just now";
  if (minutes === 1) return language === "ar" ? "دقيقة" : "1 min";
  if (minutes < 60) return language === "ar" ? `${minutes} د` : `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return language === "ar"
    ? `${h}س ${m > 0 ? `${m}د` : ""}`
    : `${h}h ${m > 0 ? `${m}m` : ""}`;
}
