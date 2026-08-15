/**
 * App-layer course catalog.
 *
 * Content lives as validated JSON in `data/courses/**` — the H1 "склад" where
 * courses are authored through code. The same JSON is mirrored into Postgres by
 * `scripts/lms-seed.mjs` so progress events have real lesson rows to reference,
 * and so the H2 builder has somewhere to write.
 *
 * Source of truth on H1: the JSON files. When the builder ships (H2), the DB
 * becomes the source and this module turns into an import path, not a reader.
 *
 * Mirrors the repo's generator convention (src/lib/generator/content.ts):
 * validate once at module load and fail loudly, rather than defensively at use.
 */

import resetDayCourse from "../../../data/courses/reset-day.json";
import { validateCourse, type Course } from "@/lms-core";

const rawCourses: unknown[] = [resetDayCourse];

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

export function listCourses(): Course[] {
  return courses;
}

/** Courses a learner may reach: drafts stay invisible outside admin tooling. */
export function listPublishedCourses(): Course[] {
  return courses.filter((course) => course.status === "published");
}

export function getCourse(slug: string): Course | null {
  return coursesBySlug.get(slug) ?? null;
}

/** Resolves the course delivering a catalog program, e.g. "reset-day". */
export function getCourseByProgram(programSlug: string): Course | null {
  return courses.find((course) => course.programSlug === programSlug) ?? null;
}
