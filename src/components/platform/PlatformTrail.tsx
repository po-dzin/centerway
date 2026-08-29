"use client";

import Link from "next/link";

import { HandGraphic, Icon } from "@/components/Icon";
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
 * WHERE IT SITS, AND WHY THAT DEPENDS ON THE BAR. The default is the page: the
 * header answers "which application is this" and should not change shape per
 * route, while the trail answers "where in this course am I" and changes on
 * every one. That separation is what stopped the BUILDER's bar being
 * overloaded — it had the brand, the trail and the step arrows on one row, and
 * the wordmark had to be hidden below 561px to make room. A row that has to
 * drop a word to fit is a row carrying someone else's job.
 *
 * THE READER IS THE EXCEPTION, above 900px only (2026-08-29). Its bar carries a
 * mark and an avatar and nothing else, so the argument above does not describe
 * it: there is no row to overload, and the breadcrumb was spending a line of
 * the reading column under some 1600px of empty bar. Below 900px the bar has no
 * room to spare and the trail stays in the page, which is where the crowding
 * argument actually bites. See `src/components/lms/ReaderTrail.tsx` — and note
 * that this is a claim about ONE bar's contents, not a general licence: a
 * surface whose bar already carries controls keeps its trail in the page.
 *
 * A step may be a LINK, a BUTTON, or neither. The button form exists because
 * the builder cannot always navigate on click: an editor with unsaved work has
 * to ask first, and the destination is the caller's to know.
 *
 * ONE LINE, ALWAYS, AND THE REST IN A TOOLTIP. Course and lesson titles are
 * sentences — «Розвантажувальний день — практикум з умовного голодування» is a
 * legitimate crumb — and a nav control that wraps to three lines stops being a
 * control and becomes a paragraph you can click. Every step is clipped to its
 * line with an ellipsis and carries the full label on `title`, so nothing is
 * hidden, it is just not in the way. Same rule for the pager at the foot of a
 * lesson.
 *
 * ON A PHONE IT IS ONE CONTROL, NOT THREE. Three crumbs at the touch minimum do
 * not fit on 375px, so they wrapped into three stacked rows — 144px of chrome
 * above a lesson, most of it spent restating the title printed immediately
 * below it. What a reader actually needs there is the way back up one level, so
 * that is what is rendered: the deepest step that can be navigated to, behind a
 * left arrow. Both forms are in the markup and CSS picks one; deciding in JS
 * would mean the server rendering the wrong one and swapping it after paint.
 */

export type TrailStep = {
  label: string;
  href?: string;
  /** Takes precedence over `href` — for a surface that must confirm before leaving. */
  onNavigate?: () => void;
};

export function PlatformTrail({
  steps,
  label = "Де ви зараз",
  tone = "page",
}: {
  steps: TrailStep[];
  label?: string;
  /**
   * Which ground this trail stands on.
   *
   * `page` is the platform's paper; `media` is a hero photograph, where the ink
   * colours the crumbs take on paper are invisible. Not a colour prop — the two
   * palettes stay in the stylesheet; this only says which one applies.
   */
  tone?: "page" | "media";
}) {
  if (steps.length === 0) return null;

  /* One level up: the deepest step that goes anywhere. On a trail whose last
     step is the current page — the usual shape — that is its parent. */
  const back = [...steps].reverse().find((step) => step.href || step.onNavigate);

  return (
    <nav className={styles.trail} data-tone={tone} aria-label={label}>
      {back ? (
        <span className={styles.back}>
          <Icon className={styles.backIcon} name="arrow-left" size={16} />
          {back.onNavigate ? (
            <button className={styles.crumbLink} type="button" onClick={back.onNavigate} title={back.label}>
              <TrailInkLabel>{back.label}</TrailInkLabel>
            </button>
          ) : (
            <Link className={styles.crumbLink} href={back.href ?? "#"} title={back.label}>
              <TrailInkLabel>{back.label}</TrailInkLabel>
            </Link>
          )}
        </span>
      ) : null}
      {steps.map((step, index) => (
        <span className={styles.step} key={`${step.label}-${index}`}>
          {index > 0 ? <Icon className={styles.sep} name="chevron-right" size={14} /> : null}
          {step.onNavigate ? (
            <button className={styles.crumbLink} type="button" onClick={step.onNavigate} title={step.label}>
              <TrailInkLabel>{step.label}</TrailInkLabel>
            </button>
          ) : step.href ? (
            <Link className={styles.crumbLink} href={step.href} title={step.label}>
              <TrailInkLabel>{step.label}</TrailInkLabel>
            </Link>
          ) : (
            // The last step is where you already are. Not a link, and dimmer
            // than the ones that are — the crumb an author can press has to be
            // the one that looks pressable.
            <span className={styles.here} aria-current="page" title={step.label}>
              <TrailInkLabel current>{step.label}</TrailInkLabel>
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function TrailInkLabel({ children, current = false }: { children: string; current?: boolean }) {
  return (
    <span className={styles.inkLabel} data-current={current || undefined}>
      <span className={styles.inkText}>{children}</span>
      <HandGraphic className={styles.inkMark} name="ink-stroke" size={36} />
    </span>
  );
}
