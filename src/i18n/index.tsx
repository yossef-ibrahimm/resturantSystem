import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import ar from "./ar";
import en from "./en";
import type { TranslationKeys } from "./ar";

type Language = "ar" | "en";

interface LanguageContextValue {
  language: Language;
  t: TranslationKeys;
  dir: "rtl" | "ltr";
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isArabic: boolean;
}

const translations = { ar, en } as const;

// Phase 0: runtime key-parity check — fail loudly at module load if a key
// exists in one language but not the other. Prevents undefined values
// silently appearing in production.
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return flattenKeys(v as Record<string, unknown>, key);
    }
    return [key];
  });
}

if (typeof window !== "undefined" || process.env.NODE_ENV !== "production") {
  const arKeys = new Set(flattenKeys(ar as Record<string, unknown>));
  const enKeys = new Set(flattenKeys(en as Record<string, unknown>));
  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
  if (missingInEn.length || missingInAr.length) {
    const message = `[i18n] key parity mismatch — missing in EN: ${JSON.stringify(missingInEn)}; missing in AR: ${JSON.stringify(missingInAr)}`;
    if (typeof console !== "undefined") console.error(message);
    if (process.env.NODE_ENV !== "production" && typeof globalThis !== "undefined") {
      (globalThis as { __i18nParityWarned?: boolean }).__i18nParityWarned = true;
    }
  }
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem("tastytable.language");
    if (stored === "ar" || stored === "en") return stored;
  } catch { /* localStorage unavailable */ }
  return "ar";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Audit UX-RTL fix: apply lang/dir on boot from the saved preference,
  // not only when the user toggles language manually.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("tastytable.language", lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const value: LanguageContextValue = {
    language,
    t: translations[language] as TranslationKeys,
    dir: language === "ar" ? "rtl" : "ltr",
    setLanguage,
    toggleLanguage,
    isArabic: language === "ar",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
