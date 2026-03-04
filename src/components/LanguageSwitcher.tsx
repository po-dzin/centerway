"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
    const { lang, setLang, t } = useI18n();
    const nextLang = ({ ru: "en", en: "ru" } as const)[lang];
    const toggle = () => setLang(nextLang);

    return (
        <button
            onClick={toggle}
            className="px-2 py-1 text-xs font-semibold rounded-md border cw-border hover:bg-[var(--cw-accent-soft)] cw-muted transition-colors uppercase"
            title={t("common_switch_language")}
        >
            {lang}
        </button>
    );
}
