import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, locale: "ar" | "en" = "ar"): string {
  const symbol = locale === "ar" ? "ج.م" : "EGP";
  return `${price.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")} ${symbol}`;
}

export function formatDate(dateString: string, locale: "ar" | "en" = "ar"): string {
  const date = new Date(dateString);
  return date.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export function timeAgo(dateString: string, locale: "ar" | "en" = "ar"): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return locale === "ar" ? "الآن" : "Just now";
  if (diffMin < 60) {
    return locale === "ar" ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return locale === "ar" ? `منذ ${diffH} ساعة` : `${diffH}h ago`;
  }
  const diffD = Math.floor(diffH / 24);
  return locale === "ar" ? `منذ ${diffD} يوم` : `${diffD}d ago`;
}

export function generateOrderNumber(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}
