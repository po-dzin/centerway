"use client";

/**
 * The admin's theme control — the product's own switch, wearing the admin's
 * icon button.
 *
 * IT USED TO BE A SECOND THEME SYSTEM (retired 2026-08-28). This component
 * toggled a `.dark` class on <html> and stored the answer under the key
 * `theme`, while every other surface stamps `data-cw-theme` from `cw-theme`.
 * Two writers, two keys, and three things that showed: no boot script, so a
 * dark admin flashed light on every load; no `color-scheme`, so the browser's
 * own painting — form controls, scrollbars, the canvas past an overscroll —
 * stayed light under a dark page; and no working light theme at all, because
 * `/admin` lives in the `(platform)` route group and the public boot script
 * stamps the document too, so dropping `.dark` left a light shell standing on
 * a graphite body. The class also survived a client-side navigation out of
 * /admin, which is why no public surface was ever allowed to key off it.
 *
 * So the state lives in `@/lib/platform/theme` now, exactly as it does in the
 * account menu, and this file is only the button. It is read with
 * `useSyncExternalStore` rather than mirrored into state: the store is the
 * source, and a switch flipped in another tab has to move this one too.
 *
 * THREE CHOICES, ONE BUTTON. The account menu can afford three icons in a row;
 * an admin bar with a language switcher and an avatar beside it cannot, so the
 * control cycles світла → темна → системна and the glyph says which one is
 * current. The tooltip names it, because a sun and a moon are guessable and a
 * screen is not.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
    applyPlatformTheme,
    readThemeChoice,
    setThemeChoice,
    subscribeThemeChoice,
    THEME_CHOICES,
    THEME_LABELS,
    type ThemeChoice,
} from "@/lib/platform/theme";

const GLYPHS: Record<ThemeChoice, React.ReactNode> = {
    light: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
    ),
    dark: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
    ),
    system: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
    ),
};

export function ThemeSwitcher() {
    const { t } = useI18n();
    // `null` on the server and for the first client frame: nothing is marked
    // until the store has been read, which is what keeps hydration honest.
    const choice = useSyncExternalStore<ThemeChoice | null>(subscribeThemeChoice, readThemeChoice, () => null);

    // `system` is not a frozen palette — it is "whatever the device says", so
    // the OS flipping under an open tab has to move the page.
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const follow = () => {
            if (readThemeChoice() === "system") applyPlatformTheme(query.matches ? "dark" : "light");
        };
        query.addEventListener("change", follow);
        return () => query.removeEventListener("change", follow);
    }, []);

    const cycle = useCallback(() => {
        const current = readThemeChoice();
        setThemeChoice(THEME_CHOICES[(THEME_CHOICES.indexOf(current) + 1) % THEME_CHOICES.length]);
    }, []);

    const shown: ThemeChoice = choice ?? "system";
    const label = `${t("common_switch_theme")} — ${THEME_LABELS[shown]}`;

    return (
        <button
            onClick={cycle}
            className="cw-icon-btn rounded-full"
            title={label}
            aria-label={label}
        >
            {GLYPHS[shown]}
        </button>
    );
}
