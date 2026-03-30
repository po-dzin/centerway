"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";
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

const LANG_KEY = "lang";
const LANG_EVENT = "cw-lang-change";

const subscribeToLang = (onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(LANG_EVENT, onStoreChange);
    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(LANG_EVENT, onStoreChange);
    };
};

const getLangSnapshot = (): Lang => {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        return saved === "en" ? "en" : "ru";
    } catch {
        return "ru";
    }
};

export function I18nProvider({ children }: { children: ReactNode }) {
    const lang = useSyncExternalStore(
        subscribeToLang,
        getLangSnapshot,
        () => "ru"
    );

    const setLang = (newLang: Lang) => {
        try {
            localStorage.setItem(LANG_KEY, newLang);
        } catch {
            // ignore storage write errors
        }
        window.dispatchEvent(new Event(LANG_EVENT));
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
