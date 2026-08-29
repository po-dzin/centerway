/**
 * The course SNAPSHOT — the copy that ships in the deploy.
 *
 * It stopped being the source of truth on 2026-08-21. The database is the
 * source now (`liveCatalog.ts`), because an author publishing in the builder
 * has to reach a learner without the owner running a CLI and a deploy. What
 * these files became is the fallback underneath that: the last known good copy,
 * served whenever the live read cannot answer. `npm run lms:pull` is how the
 * snapshot is refreshed, and it is a safety net now rather than the delivery
 * path.
 *
 * DELIBERATELY FILE-ONLY AND SYNCHRONOUS. Nothing here touches Supabase, which
 * is what lets the marketing pages stay statically prerendered and the unit
 * tests read real courses without a database. Anything learner-facing must call
 * `liveCatalog.ts` instead — the names here all say `snapshot` so a call site
 * cannot pick the wrong source by accident.
 *
 * Mirrors the repo's generator convention (src/lib/generator/content.ts):
 * validate once at module load and fail loudly, rather than defensively at use.
 */

import naturalBodyCourse from "../../../data/courses/natural-body.json";
import resetDayCourse from "../../../data/courses/reset-day.json";
import shortCourse from "../../../data/courses/short.json";
import way21Course from "../../../data/courses/way21.json";
import { validateCourse, type Course } from "@/lms-core";

const rawCourses: unknown[] = [naturalBodyCourse, resetDayCourse, shortCourse, way21Course];

function loadCourses(): Course[] {
  return rawCourses.map((raw, index) => {
    // Throws with a machine-readable `lms_*:path` code — same shape as the
    // generator validators, so seed, gate and runtime all fail identically.
    validateCourse(raw, `data/courses[${index}]`);
    return raw;
  });
}

const courses = loadCourses();
const coursesBySlug = new Map(courses.map((course) => [course.slug, course]));

export function snapshotCourses(): Course[] {
  return courses;
}

/** Snapshot courses a learner may reach: drafts stay invisible outside admin tooling. */
export function listPublishedSnapshotCourses(): Course[] {
  return courses.filter((course) => course.status === "published");
}

export function getSnapshotCourse(slug: string): Course | null {
  return coursesBySlug.get(slug) ?? null;
}

/**
 * The snapshot course delivering a catalog program, e.g. "reset-day".
 *
 * Snapshot on purpose: its one caller is the public program page, which needs a
 * lesson count for a marketing claim and is statically prerendered. A live read
 * there would turn a static marketing page into a per-request database query to
 * change a number that changes once a quarter.
 */
export function getSnapshotCourseByProgram(programSlug: string): Course | null {
  return courses.find((course) => course.programSlug === programSlug) ?? null;
}
