"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
    const { lang, setLang, t } = useI18n();
    const nextLang = ({ ru: "en", en: "ru" } as const)[lang];
    const toggle = () => setLang(nextLang);

    return (
        <button
            onClick={toggle}
            className="cw-btn cw-btn-sm cw-btn-muted font-semibold uppercase"
            title={t("common_switch_language")}
        >
            {lang}
        </button>
    );
}
