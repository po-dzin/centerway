"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
    const { lang, setLang, t } = useI18n();
    const nextLang = ({ ru: "en", en: "ru" } as const)[lang];
    const toggle = () => setLang(nextLang);

    return (
        <button
            onClick={toggle}
            // `.cw-btn`'s own `min-height` is the touch-target rule (3rem), sized
            // for a row of running text — next to the icon buttons either side of
            // it in this same toolbar it read as a stretched pill with no matching
            // width. Fixed to the icon buttons' own box (`.cw-icon-btn`'s padding
            // around an 18px glyph) instead, so the three controls sit as one set.
            className="cw-icon-btn w-9 h-9 flex items-center justify-center text-[11px] font-bold uppercase leading-none"
            title={t("common_switch_language")}
        >
            {lang}
        </button>
    );
}
