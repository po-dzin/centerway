"use client";

/**
 * A tab's contents, kept alive once opened.
 *
 * WHAT IT FIXES. The panel's tabs used to be a ternary: the tab you left was
 * unmounted, and everything it held went with it — a half-typed grant form, a
 * search you had refined, which page of a long list you were on, an accordion
 * you had opened to compare two rows. Coming back landed you at the top of a
 * freshly-loading table with empty fields. That is fine for a page you visit
 * once and expensive for a panel where the whole job is moving between four
 * views of the same person.
 *
 * WHY MOUNTED-AND-HIDDEN, not saved state. Lifting every field into the parent
 * would mean threading fifty-odd values through four components, and a store
 * keyed by field name would mean naming them all and keeping the names in step.
 * Leaving the component mounted preserves what it already knows, for free and
 * without a list of what is worth preserving: drafts, scroll, loaded rows, an
 * in-flight request, the lot.
 *
 * LAZY UNTIL FIRST OPENED, so the cost is only what you actually looked at:
 * four tabs mounted at once is four tables fetched by a page you opened to read
 * one. After that the tab stays, and its `load()` does not run again — which is
 * also why switching back is instant rather than another spinner.
 *
 * `hidden` rather than a class: it takes the element out of the accessibility
 * tree and out of tab order, so a screen reader and the Tab key do not walk
 * through three invisible tables to reach the visible one. `display` from a
 * stylesheet would hide it visually and leave both of those wrong.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

export function AdminTabPanel({ active, children }: { active: boolean; children: ReactNode }) {
    // State rather than a ref, because a ref written during render is exactly
    // the bug the rule warns about: the write would not schedule the re-render
    // that a stale `false` needs to recover from. It only ever goes false → true.
    const [opened, setOpened] = useState(active);

    // Adjusting state during render, which is React's own answer for a value
    // derived from a prop (react.dev, "You Might Not Need an Effect"). React
    // re-runs this component immediately, before touching the DOM or any child,
    // so it costs nothing an effect would not have cost more of — and unlike an
    // effect it cannot flash the wrong thing for a frame.
    if (active && !opened) setOpened(true);

    if (!opened && !active) return null;

    return (
        <div hidden={!active} aria-hidden={!active ? true : undefined}>
            {children}
        </div>
    );
}

/**
 * The tab a page opens on, remembered for the length of the browser tab.
 *
 * Switching admin pages and coming back is the same interruption as switching
 * tabs, and it lost the same thing. `sessionStorage` rather than `localStorage`
 * on purpose: this is where you were in THIS sitting, not a preference you set.
 *
 * READ AFTER MOUNT, NOT DURING THE FIRST RENDER. This runs inside a client
 * component that Next still renders on the server, where `sessionStorage` does
 * not exist and the answer would be the fallback — so reading it in a `useState`
 * initialiser makes the first client render disagree with the server's and
 * React throws a hydration mismatch. One extra render is the price of not
 * having that.
 */
export function useStickyTab<T extends string>(
    storageKey: string,
    fallback: T,
    allowed: readonly T[],
): [T, (next: T) => void] {
    const key = `cw-admin-tab:${storageKey}`;
    const [tab, setTab] = useState<T>(fallback);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(key);
            if (stored && (allowed as readonly string[]).includes(stored)) setTab(stored as T);
        } catch {
            /* Private mode or storage disabled: the fallback is a correct answer. */
        }
        // `allowed` is a literal rebuilt every render; its CONTENTS are static,
        // and re-running this on a new array identity would fight the operator
        // by resetting the tab they just picked.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const choose = useCallback((next: T) => {
        setTab(next);
        try {
            sessionStorage.setItem(key, next);
        } catch {
            /* Nothing to do — the tab simply will not be remembered. */
        }
    }, [key]);

    return [tab, choose];
}
