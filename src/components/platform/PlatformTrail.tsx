"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import styles from "./PlatformTrail.module.css";

/**
 * One breadcrumb for every CenterWay surface that has a hierarchy.
 *
 * WHY IT IS SHARED, AND WHO IS NOT IN IT. The builder (курси → курс → урок) and
 * the learner's course player (мої курси → курс → урок) are the same three
 * levels seen from two sides, drawn from the same tokens by the same CSS-module
 * system — one component, one visual. The ADMIN is deliberately out: it runs
 * its own grey skin on Tailwind utilities (`cw-admin-theme`), and pulling
 * `--ds-*` into it is exactly the cross-layer consumption `guard:ds-contract`
 * bans. Its one hand-rolled crumb can adopt this the day admin moves onto the
 * design system, and not before.
 *
 * WHY IT SITS IN THE PAGE AND NOT IN THE HEADER. The header answers "which
 * application is this" and it should not change shape per route; the trail
 * answers "where in this course am I" and changes on every one. Keeping them
 * apart is also what made the builder's bar stop being overloaded — it had the
 * brand, the trail and the step arrows on one row, and the wordmark had to be
 * hidden below 561px to make room. A row that has to drop a word to fit is a
 * row carrying someone else's job.
 *
 * A step may be a LINK, a BUTTON, or neither. The button form exists because
 * the builder cannot always navigate on click: an editor with unsaved work has
 * to ask first, and the destination is the caller's to know.
 */

export type TrailStep = {
  label: string;
  href?: string;
  /** Takes precedence over `href` — for a surface that must confirm before leaving. */
  onNavigate?: () => void;
};

export function PlatformTrail({ steps, label = "Де ви зараз" }: { steps: TrailStep[]; label?: string }) {
  if (steps.length === 0) return null;

  return (
    <nav className={styles.trail} aria-label={label}>
      {steps.map((step, index) => (
        <span className={styles.step} key={`${step.label}-${index}`}>
          {index > 0 ? <Icon className={styles.sep} name="chevron-right" size={14} /> : null}
          {step.onNavigate ? (
            <button className={styles.crumbLink} type="button" onClick={step.onNavigate}>
              {step.label}
            </button>
          ) : step.href ? (
            <Link className={styles.crumbLink} href={step.href}>
              {step.label}
            </Link>
          ) : (
            // The last step is where you already are. Not a link, and dimmer
            // than the ones that are — the crumb an author can press has to be
            // the one that looks pressable.
            <span className={styles.here} aria-current="page">
              {step.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
