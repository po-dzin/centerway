"use client";

/**
 * The profile's own sections, under the room (G 23.10, profile v1).
 *
 * «Огляд · Карта · Ритм · Курси · Журнал». The first four are the profile itself
 * (G 23.10: the map lives inside the profile as a tab, not on a sheet of its
 * own): they switch in place under the same room, and the address follows —
 * `/profile`, `/profile/map`, `/profile/rhythm`, `/profile/courses` — so a link, a reload or
 * «back» lands on the same tab. The journal joined them on 24.10 (G: «журнал
 * должен быть виден в табе профиля»); `/journal` stays for old links.
 * The current one carries the ink stroke (`InteractionInkLabel variant="tab"`,
 * selection family `ink`) and `aria-current`.
 */

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import type { ProfileLang } from "@/components/platform/profile/types";
import {
  PROFILE_COURSES_HREF,
  PROFILE_HREF,
  PROFILE_JOURNAL_HREF,
  PROFILE_RHYTHM_HREF,
  SPHERE_MAP_HREF,
} from "@/lib/platform/content";

import styles from "./Cabinet.module.css";

/** The sections that render inside the profile itself. */
export type ProfileTab = "overview" | "map" | "rhythm" | "courses" | "journal";

type Key = ProfileTab;

const LABELS: Record<ProfileLang, Record<Key, string>> = {
  uk: { overview: "Огляд", map: "Карта", rhythm: "Ритм", courses: "Програми", journal: "Журнал" },
  en: { overview: "Overview", map: "Map", rhythm: "Rhythm", courses: "Programs", journal: "Journal" },
};

const ARIA: Record<ProfileLang, string> = { uk: "Розділи профілю", en: "Profile sections" };

const TAB_PATHS: Record<ProfileTab, string> = {
  overview: PROFILE_HREF,
  map: SPHERE_MAP_HREF,
  rhythm: PROFILE_RHYTHM_HREF,
  courses: PROFILE_COURSES_HREF,
  journal: PROFILE_JOURNAL_HREF,
};

function tabFromPath(pathname: string): ProfileTab {
  const path = pathname.replace(/\/+$/, "");
  if (path.endsWith(SPHERE_MAP_HREF)) return "map";
  if (path.endsWith(PROFILE_RHYTHM_HREF)) return "rhythm";
  if (path.endsWith(PROFILE_COURSES_HREF)) return "courses";
  if (path.endsWith(PROFILE_JOURNAL_HREF)) return "journal";
  return "overview";
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
    const path = TAB_PATHS[next];
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
    /* A reader who switched from below the tabs lands at the top of the new
       tab, with the tabs under the bar — not wherever the old tab's length
       left the scroll, and never back at the hero. */
    window.requestAnimationFrame(() => {
      const nav = document.querySelector<HTMLElement>("[data-cw-profile-tabs]");
      if (!nav) return;
      const margin = Number.parseFloat(getComputedStyle(nav).scrollMarginTop) || 0;
      if (nav.getBoundingClientRect().top < margin) nav.scrollIntoView({ block: "start" });
    });
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
  links: { map: string; rhythm: string; courses: string; journal: string };
  lang: ProfileLang;
  overviewHref?: string;
  /** Switch a tab in place (every tab, the journal included, since 24.10). */
  onSelect?: (tab: ProfileTab) => void;
}) {
  const labels = LABELS[lang] ?? LABELS.uk;
  const items: { key: Key; href: string }[] = [
    { key: "overview", href: overviewHref },
    { key: "map", href: links.map },
    { key: "rhythm", href: links.rhythm },
    { key: "courses", href: links.courses },
    { key: "journal", href: links.journal },
  ];
  return (
    <nav className={styles.tabs} aria-label={ARIA[lang] ?? ARIA.uk} data-cw-profile-tabs="">
      {items.map(({ key, href }) => {
        const active = key === current;
        const select = (event: MouseEvent<HTMLAnchorElement>) => {
          if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onSelect(key);
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
