"use client";

import Link from "next/link";

import { HandGraphic, Icon } from "@/components/Icon";
import { BUILDER_COURSES_PATH, BUILDER_PATH_PREFIX } from "@/lib/surfaces/catalog";
import { InkLabel } from "./BuilderInkLabel";
import styles from "./Builder.module.css";

/**
 * The workshop's own sections, in the workspace's left track.
 *
 * WHY THE ROOT SURFACES GET A RAIL AT ALL. `.bodyWithAside` reserves three
 * tracks and the outer two never change size — that is the whole reason a
 * course workspace and a lesson keep the document on one axis while panels open
 * and close. A surface with NO aside falls back to `.body`, which centres the
 * page in the full width: crossing from `/build/courses` into a course used to
 * shift the manuscript sideways, because one of the two screens was not in the
 * frame at all. The overview and the shelf are now in it, and what fills the
 * left track is the honest answer to the question that track answers — «what is
 * in this place» (`docs/design-system.md`, the chrome's two pairs).
 *
 * TWO ROWS, AND THE SECOND ONE IS THE SHELF. `/build` states standing,
 * `/build/courses` holds the courses. They are the workshop's two rooms, and
 * naming them here is what makes the split navigable rather than a link buried
 * beside a page title.
 *
 * `selection_family = ink`: a change of place on an unmaterialised panel, so the
 * current row is the shared stroke at full strength and the icon takes the
 * shared ring — the same two marks the course rail draws, from the same
 * components. No plate, no contour, no local geometry.
 */
export function BuilderWorkshopRail({ current }: { current: "overview" | "courses" }) {
  return (
    <div className={styles.courseRail}>
      <nav className={styles.courseRailNav} aria-label="Розділи майстерні">
        <Link
          className={styles.courseRailLink}
          href={BUILDER_PATH_PREFIX}
          aria-current={current === "overview" ? "page" : undefined}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="lens" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <InkLabel>Огляд</InkLabel>
        </Link>
        <Link
          className={styles.courseRailLink}
          href={BUILDER_COURSES_PATH}
          aria-current={current === "courses" ? "page" : undefined}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="list" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <InkLabel>Матеріали</InkLabel>
        </Link>
      </nav>
    </div>
  );
}
