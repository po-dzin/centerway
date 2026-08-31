"use client";

import { PlatformTrail } from "@/components/platform/PlatformTrail";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";

import styles from "./ReaderTrail.module.css";

/**
 * The reader's breadcrumb, in the topbar rather than in the page.
 *
 * WHY IT MOVED, AND WHY ONLY HERE. `PlatformTrail` says the trail belongs in
 * the page because the header "should not change shape per route" — written
 * when the BUILDER's bar carried the brand, the trail and the step arrows on
 * one row and had to hide the wordmark below 561px. The reader's bar carries a
 * mark and an avatar and nothing else: on a 1920 screen that is some 1600px of
 * empty bar above a breadcrumb taking a line of the reading column. The rule
 * that row was protecting is a rule about a CROWDED bar, and this one is not.
 *
 * ABOVE 900px ONLY. Below it the bar has no room to spare and the trail stays
 * where it was — so the case that produced the original rule never arises. The
 * two copies never coexist: each is `display: none` at the other's width, which
 * takes it out of the accessibility tree as well as off the screen, so a screen
 * reader is offered one breadcrumb and not two.
 *
 * The steps are built here rather than passed in resolved because `href` is
 * host-dependent — `/learn/...` is an address on `my` and a route on `www` —
 * and `useSurfaceHref` is the one resolver that knows which.
 */
export function ReaderTrail({
  courseSlug,
  courseTitle,
  lessonTitle,
}: {
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
}) {
  const surfaceHref = useSurfaceHref();

  return (
    <div className={styles.readerTrail}>
      <PlatformTrail
        steps={[
          { label: "Мої матеріали", href: surfaceHref(LEARNING_SHELF_HREF) },
          { label: courseTitle, href: surfaceHref(`/learn/${courseSlug}`) },
          { label: lessonTitle },
        ]}
      />
    </div>
  );
}
