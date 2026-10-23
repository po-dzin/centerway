"use client";

/**
 * The profile's own sections, under the room (G 23.10, profile v1).
 *
 * «Огляд · Карта · Журнал · Бібліотека». The first two are the profile itself
 * (G 23.10: the map lives inside the profile as a tab, not on a sheet of its
 * own): they switch in place under the same room, and the address follows —
 * `/profile` and `/profile/map` — so a link, a reload or «back» lands on the
 * same tab. The journal and the library are their own places and stay links.
 * The current one carries the ink stroke (`InteractionInkLabel variant="tab"`,
 * selection family `ink`) and `aria-current`.
 */

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import type { ProfileLang } from "@/components/platform/profile/types";
import { PROFILE_HREF, SPHERE_MAP_HREF } from "@/lib/platform/content";

import styles from "./Cabinet.module.css";

/** The sections that render inside the profile itself. */
export type ProfileTab = "overview" | "map";

type Key = ProfileTab | "journal" | "library";

const LABELS: Record<ProfileLang, Record<Key, string>> = {
  uk: { overview: "Огляд", map: "Карта", journal: "Журнал", library: "Бібліотека" },
  en: { overview: "Overview", map: "Map", journal: "Journal", library: "Library" },
};

const ARIA: Record<ProfileLang, string> = { uk: "Розділи профілю", en: "Profile sections" };

function tabFromPath(pathname: string): ProfileTab {
  return pathname.replace(/\/+$/, "").endsWith(SPHERE_MAP_HREF) ? "map" : "overview";
}

/**
 * The open tab, kept in step with the address. Switching pushes the tab's own
 * path without a navigation (the room and the profile's data stay mounted);
 * «back» and «forward» move between tabs.
 */
export function useProfileTab(initial: ProfileTab): [ProfileTab, (next: ProfileTab) => void] {
  const [tab, setTabState] = useState<ProfileTab>(initial);

  useEffect(() => {
    const onPop = () => setTabState(tabFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setTab = useCallback((next: ProfileTab) => {
    setTabState(next);
    const path = next === "map" ? SPHERE_MAP_HREF : PROFILE_HREF;
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
  }, []);

  return [tab, setTab];
}

export function ProfileTabs({
  current,
  links,
  lang,
  overviewHref = PROFILE_HREF,
  onSelect,
}: {
  current: ProfileTab;
  links: { map: string; journal: string; library: string };
  lang: ProfileLang;
  overviewHref?: string;
  /** Switch an in-profile tab in place; the journal and the library stay links. */
  onSelect?: (tab: ProfileTab) => void;
}) {
  const labels = LABELS[lang] ?? LABELS.uk;
  const items: { key: Key; href: string }[] = [
    { key: "overview", href: overviewHref },
    { key: "map", href: links.map },
    { key: "journal", href: links.journal },
    { key: "library", href: links.library },
  ];
  return (
    <nav className={styles.tabs} aria-label={ARIA[lang] ?? ARIA.uk}>
      {items.map(({ key, href }) => {
        const active = key === current;
        const inPlace = onSelect && (key === "overview" || key === "map");
        const select = (event: MouseEvent<HTMLAnchorElement>) => {
          if (!inPlace || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onSelect(key as ProfileTab);
        };
        return (
          <Link
            key={key}
            className={styles.tab}
            href={href}
            onClick={select}
            data-cw-ink-control=""
            aria-current={active ? "page" : undefined}
            data-current={active || undefined}
          >
            <InteractionInkLabel variant="tab" active={active}>
              {labels[key]}
            </InteractionInkLabel>
          </Link>
        );
      })}
    </nav>
  );
}
