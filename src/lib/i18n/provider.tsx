import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Dict } from "@/lib/i18n/en";
import { uk } from "@/lib/i18n/uk";
import { browserLang, readLang, writeLang } from "@/lib/storage";

type Lang = "en" | "uk";

type I18nValue = {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nValue>({
  lang: "en",
  t: en,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = readLang();
    setLangState(stored ?? browserLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "uk" ? "uk" : "en";
    document.title = lang === "uk" ? uk.metaTitle : en.metaTitle;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: lang === "uk" ? uk : en,
      setLang: (next) => {
        writeLang(next);
        setLangState(next);
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
