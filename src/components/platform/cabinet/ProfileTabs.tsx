"use client";

/**
 * The profile's own sections, under the room (G 23.10, profile v1).
 *
 * «Огляд · Карта · Журнал · Бібліотека» — the four places that belong to the
 * person rather than to a course. They are links, not tabs that hide the rest
 * of the page: each is its own address (`/profile`, `/profile/map`,
 * `/journal`, `/learn`) with the way back to the profile, so a section never
 * replaces the profile, it opens from it. The current one carries the ink
 * stroke (`InteractionInkLabel variant="tab"`, selection family `ink`) and
 * `aria-current`.
 */

import Link from "next/link";

import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import type { ProfileLang } from "@/components/platform/profile/types";

import styles from "./Cabinet.module.css";

type Key = "overview" | "map" | "journal" | "library";

const LABELS: Record<ProfileLang, Record<Key, string>> = {
  uk: { overview: "Огляд", map: "Карта", journal: "Журнал", library: "Бібліотека" },
  en: { overview: "Overview", map: "Map", journal: "Journal", library: "Library" },
};

const ARIA: Record<ProfileLang, string> = { uk: "Розділи профілю", en: "Profile sections" };

export function ProfileTabs({
  current,
  links,
  lang,
  overviewHref = "#",
}: {
  current: Key;
  links: { map: string; journal: string; library: string };
  lang: ProfileLang;
  overviewHref?: string;
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
        return (
          <Link
            key={key}
            className={styles.tab}
            href={href}
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
