import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Lang, translations, TKey } from "./translations";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; fmt: (n: number) => string };

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "bn");

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.body.classList.toggle("font-bn", lang === "bn");
  }, [lang]);

  const t = (k: TKey) => translations[lang][k] ?? k;
  const fmt = (n: number) => {
    const formatted = new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);
    return `৳${formatted}`;
  };

  return <LanguageContext.Provider value={{ lang, setLang: setLangState, t, fmt }}>{children}</LanguageContext.Provider>;
}

export const useT = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be inside LanguageProvider");
  return ctx;
};
