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
      <PlatformTrail
        steps={[
          { label: "Мої матеріали", href: href(LEARNING_SHELF_HREF) },
          { label: courseTitle },
        ]}
      />
    </div>
  );
}

/** The short mobile bar keeps only its own back affordance in the page. */
export function CourseBodyTrail({ href, courseTitle }: { href: (path: string) => string; courseTitle: string }) {
  return (
    <div className={styles.courseTrailFallback}>
      <PlatformTrail steps={[{ label: "Мої матеріали", href: href(LEARNING_SHELF_HREF) }, { label: courseTitle }]} />
    </div>
  );
}
