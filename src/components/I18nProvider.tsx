"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, translations, TranslationKey } from "@/lib/i18n";

interface I18nContextValue {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
    lang: "ru",
    setLang: () => { },
    t: (key) => translations.ru[key],
});

export function I18nProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>("ru");

    useEffect(() => {
        const saved = localStorage.getItem("lang") as Lang | null;
        if (saved === "ru" || saved === "en") {
            setLangState(saved);
        }
    }, []);

    const setLang = (newLang: Lang) => {
        setLangState(newLang);
        localStorage.setItem("lang", newLang);
    };

    const t = (key: TranslationKey): string => translations[lang][key];

    return (
        <I18nContext.Provider value={{ lang, setLang, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    return useContext(I18nContext);
}
