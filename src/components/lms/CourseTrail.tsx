"use client";

import { PlatformTrail } from "@/components/platform/PlatformTrail";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";

import styles from "./Lms.module.css";

type CourseTrailProps = {
  courseTitle: string;
};

/** The desktop course-map path belongs in the shared workspace topbar. */
export function CourseTopbarTrail({ courseTitle }: CourseTrailProps) {
  const href = useSurfaceHref();
  return (
    <div className={styles.courseTopbarTrail}>
      <PlatformTrail steps={[{ label: "Мої матеріали", href: href(LEARNING_SHELF_HREF) }, { label: courseTitle }]} />
    </div>
  );
}

/* THE MOBILE TRAIL IS GONE (2026-09-06). `CourseBodyTrail` printed «← Мої
   матеріали / Назва курсу» in the document below 901px, which is the move the
   leading island now makes with an arrow — and it printed the course's name a
   line above the heading that carries it. One fact, one control. The wide
   screen keeps `CourseTopbarTrail`, where a path has the room to be one. */
