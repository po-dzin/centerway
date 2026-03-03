"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
    const { lang, setLang } = useI18n();

    const toggle = () => setLang(lang === "ru" ? "en" : "ru");

    return (
        <button
            onClick={toggle}
            className="px-2 py-1 text-xs font-semibold rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors uppercase"
            title="Switch Language"
        >
            {lang}
        </button>
    );
}
