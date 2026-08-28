"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { HandGraphic, Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./PlatformThemeControl.module.css";
import {
  applyPlatformTheme,
  readThemeChoice,
  resolveTheme,
  setThemeChoice,
  subscribeThemeChoice,
  THEME_CHOICES,
  THEME_LABELS,
  type ThemeChoice,
} from "@/lib/platform/theme";

/* Sun, moon, and the machine. `display` is the third because the state is not a
   dimmer between the other two — it is "whatever the device says", and a screen
   says that where a half-filled disc says "somewhere in between". */
const THEME_GLYPH: Record<ThemeChoice, CwIconName> = {
  light: "sun",
  dark: "moon",
  system: "display",
};

/**
 * Світла / Темна / Системна.
 *
 * The component never renders the theme — the boot script did that before the
 * first frame. What it renders is WHICH OF THE THREE IS CHOSEN, and that lives
 * in `localStorage`, outside React. So it is read with `useSyncExternalStore`
 * rather than mirrored into state in an effect: the store is the source, the
 * server snapshot is `null` (no option marked), and every writer — this
 * control, or the same control in another tab — publishes one event that every
 * mounted copy hears. Mirroring would mean a second copy of the truth, and two
 * of these render at once on a public page: one in the footer, one in the
 * account menu.
 */


export function PlatformThemeControl() {
  const choice = useSyncExternalStore<ThemeChoice | null>(subscribeThemeChoice, readThemeChoice, () => null);

  // The OS flipping under an open tab matters only while the choice is
  // `system` — that is what `system` means, and re-reading the store here
  // rather than closing over `choice` keeps this listener correct without
  // being re-subscribed on every change.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (readThemeChoice() === "system") applyPlatformTheme(query.matches ? "dark" : "light");
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  // A theme chosen in another tab has to land on this document too, not just
  // on this control's pressed state.
  useEffect(() => {
    const repaint = () => applyPlatformTheme(resolveTheme(readThemeChoice()));
    window.addEventListener("storage", repaint);
    return () => window.removeEventListener("storage", repaint);
  }, []);

  // One writer for the three things a theme change is: the stored choice, the
  // document, and the other copies of this control. See `setThemeChoice`.
  const pick = useCallback((next: ThemeChoice) => setThemeChoice(next), []);

  return (
    <div className={styles.control} role="group" aria-label="Тема">
      {THEME_CHOICES.map((value) => (
        <button
          key={value}
          type="button"
          className={styles.option}
          aria-pressed={choice === value}
          aria-label={THEME_LABELS[value]}
          title={THEME_LABELS[value]}
          onClick={() => pick(value)}
        >
          {/* 20 is the floor the icon primitive states for itself — below it
              the baked hand starts eating its own counters. */}
          <Icon name={THEME_GLYPH[value]} size={20} />
          {/* THE MARK IS THE MENU'S OWN, not a CSS bar under the glyph. This
              control renders inside `.profileMenu`, and that scope turns off
              `::after` on every one of its buttons on purpose: its rows carry a
              drawn ink stroke (`ink-stroke` from the sprite) because a
              text-decoration cannot be transitioned in width. So a marker built
              as a pseudo-element here does not merely look different — it is
              erased, which is why the gold never appeared. Same graphic, same
              three numbers, sized to a glyph instead of a word. */}
          {/* THE RING, NOT A STROKE. The system already answers "how is an
              ICON-ONLY control marked" and the answer is the ink ring — it is
              what the header's menu button and the avatar wear, it has its own
              token (`--cw-ink-ring-size`), and PlatformButtons says it in one
              line: icon-only chrome is guided by the baked ink ring supplied by
              its consumer. A short stroke under a glyph was a second answer to
              a question that had one; the underline belongs to labels, because
              a label has a length for a rule to measure.

              (It also cannot be a pseudo-element here: `.profileMenu` sets
              `content: none` on every button's `::after` on purpose, so a CSS
              bar is not a different-looking mark but an erased one.) */}
          <HandGraphic className={styles.ring} name="ink-ring" size={48} />
        </button>
      ))}
    </div>
  );
}
