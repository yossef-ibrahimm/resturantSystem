import { useEffect } from "react";
import { useSettingsQuery } from "@/hooks/useSettings";
import { useLanguage } from "@/i18n";

function hexToHsl(hex: string): string {
  const { h, s, l } = hexToHslParts(hex);
  return `${h} ${s}% ${l}%`;
}

function hexToHslParts(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function deriveHoverHsl(hex: string): string {
  const { h, s, l } = hexToHslParts(hex);
  const shifted = l <= 14 ? Math.min(100, l + 6) : Math.max(0, l - 8);
  return `${h} ${s}% ${shifted}%`;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "150 18% 12%" : "38 40% 96%";
}

export default function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettingsQuery();
  const { isArabic } = useLanguage();

  useEffect(() => {
    const root = document.documentElement;

    if (settings?.primaryColor) {
      const hsl = hexToHsl(settings.primaryColor);
      const fg = getContrastColor(settings.primaryColor);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--primary-hover", deriveHoverHsl(settings.primaryColor));
      root.style.setProperty("--primary-foreground", fg);
      root.style.setProperty("--ring", hsl);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-hover");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
    }

    if (settings?.secondaryColor) {
      const hsl = hexToHsl(settings.secondaryColor);
      root.style.setProperty("--accent", hsl);
    } else {
      root.style.removeProperty("--accent");
    }

    if (settings?.backgroundColor) {
      const hsl = hexToHsl(settings.backgroundColor);
      root.style.setProperty("--background", hsl);
      root.style.setProperty("--card", hsl);
    } else {
      root.style.removeProperty("--background");
      root.style.removeProperty("--card");
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      const name = isArabic ? settings.nameAr : settings.nameEn;
      if (name) {
        document.title = name;
      }
    }
  }, [settings, isArabic]);

  return <>{children}</>;
}
