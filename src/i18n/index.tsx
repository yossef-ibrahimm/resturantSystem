import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("tastytable.language", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const value: LanguageContextValue = {
    language,
    t: translations[language],
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
