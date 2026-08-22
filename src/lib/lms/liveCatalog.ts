/**
 * The course a learner actually gets: the database, with the shipped file as
 * the fallback underneath it.
 *
 * WHY THIS EXISTS. Until now `catalog.ts` was the source of truth and it reads
 * files, so publishing in the builder changed a row nobody read: an author's
 * edits reached a learner only after `npm run lms:pull` and a deploy — by the
 * owner. That makes the builder a generator of chores rather than a tool. The
 * database is the source now, and the author publishes for real.
 *
 * WHY A FALLBACK AND NOT A SWITCH. The old path had one genuine virtue: a
 * static import cannot fail at request time. A database read can, and the thing
 * it would break is a person opening a course they paid for. So the file stays,
 * demoted from source to SNAPSHOT — the last known good copy, served whenever
 * the live read cannot answer.
 *
 * THE THREE ANSWERS, and the middle one is the whole design:
 *
 *   · the row EXISTS      → serve it, whatever its status. Draft included: a
 *     draft is how staff and manual-grant holders preview, and `server.ts`
 *     already owns that gate. This is also what makes unpublishing work — the
 *     row stays and turns `draft`, and the gate closes.
 *   · the row is ABSENT   → serve the snapshot. A course present in git and
 *     missing from the database is a seeding mistake, and the answer to a
 *     mistake must not be taking a paid course away from the people in it.
 *   · the read FAILED     → serve the snapshot, and say so in the log. This is
 *     the case the fallback was built for.
 *
 * The one gap this closed: deleting a course ROW that still has a checked-in
 * snapshot would resurrect the file the moment the row disappeared, since the
 * absent-row branch exists precisely to survive a seeding mistake and cannot
 * tell that apart from an intentional delete. `deleteBuilderCourse` now refuses
 * a snapshot-backed slug outright, on top of refusing anything published or
 * enrolled — retiring one of these for real is a git change (delete the JSON,
 * `lms:pull` has nothing left to protect), not a database delete.
 */

import { unstable_cache } from "next/cache";

import { adminClient } from "@/lib/auth/adminClient";
import { courseFromRows } from "./authoring";
import { getSnapshotCourse, snapshotCourses } from "./catalog";
import type { Course } from "@/lms-core";

type Row = Record<string, unknown>;

/** Cache tag for one course, so a publish can drop exactly that entry. */
export function courseTag(slug: string): string {
  return `lms-course:${slug}`;
}

/** Cache tag for anything that lists courses. */
export const COURSE_LIST_TAG = "lms-courses";

/**
 * A backstop, not the mechanism. Invalidation is by tag and happens the moment
 * the builder writes; this only bounds how long a stale entry could survive a
 * write that failed to revalidate — a deploy mid-publish, say.
 */
const REVALIDATE_SECONDS = 120;

/**
 * The profile every authoring write purges with. Next 16 asks `revalidateTag`
 * how stale the caller is willing to leave the entry; the answer here is "not
 * at all" — an author who pressed «Опублікувати» is about to check whether it
 * worked, and a publish that lands in two minutes is a publish they will
 * report as broken.
 */
export const PURGE = { expire: 0 } as const;

type LiveRead =
  | { kind: "course"; course: Course }
  | { kind: "absent" }
  | { kind: "unavailable"; reason: string };

async function readCourse(slug: string): Promise<LiveRead> {
  try {
    const db = adminClient();
    const { data: courseRow, error } = await db.from("lms_courses").select("*").eq("slug", slug).maybeSingle();
    if (error) return { kind: "unavailable", reason: error.message };
    if (!courseRow) return { kind: "absent" };

    const courseId = (courseRow as Row).id as string;
    const [modules, lessons] = await Promise.all([
      db.from("lms_modules").select("*").eq("course_id", courseId),
      db.from("lms_lessons").select("*").eq("course_id", courseId),
    ]);
    if (modules.error) return { kind: "unavailable", reason: modules.error.message };
    if (lessons.error) return { kind: "unavailable", reason: lessons.error.message };

    // `courseFromRows` validates, so a structure the contract rejects lands
    // here as a throw and is treated as unavailable — the snapshot is served
    // rather than a half course.
    return {
      kind: "course",
      course: courseFromRows(courseRow as Row, (modules.data ?? []) as Row[], (lessons.data ?? []) as Row[]),
    };
  } catch (error) {
    return { kind: "unavailable", reason: error instanceof Error ? error.message : "unknown_error" };
  }
}

const cachedCourse = (slug: string) =>
  unstable_cache(() => readCourse(slug), ["lms-live-course", slug], {
    tags: [courseTag(slug), COURSE_LIST_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();

/**
 * One course, live. Returns drafts too — the caller owns the status gate.
 */
export async function getLiveCourse(slug: string): Promise<Course | null> {
  const read = await cachedCourse(slug);

  if (read.kind === "course") return read.course;
  if (read.kind === "unavailable") {
    // Loud, because a learner is being served yesterday's copy and the reason
    // is infrastructure, not content.
    console.warn(`lms_live_course_unavailable:${slug}:${read.reason} — serving the shipped snapshot`);
  }
  return getSnapshotCourse(slug);
}

async function readAll(): Promise<{ courses: Course[]; complete: boolean }> {
  try {
    const db = adminClient();
    const [courseRows, moduleRows, lessonRows] = await Promise.all([
      db.from("lms_courses").select("*"),
      db.from("lms_modules").select("*"),
      db.from("lms_lessons").select("*"),
    ]);
    if (courseRows.error || moduleRows.error || lessonRows.error) {
      return { courses: [], complete: false };
    }

    const modules = (moduleRows.data ?? []) as Row[];
    const lessons = (lessonRows.data ?? []) as Row[];
    const courses: Course[] = [];

    for (const row of (courseRows.data ?? []) as Row[]) {
      try {
        courses.push(
          courseFromRows(
            row,
            modules.filter((module) => module.course_id === row.id),
            lessons.filter((lesson) => lesson.course_id === row.id)
          )
        );
      } catch (error) {
        // One malformed course must not empty the shelf for every other one.
        console.warn(`lms_live_course_invalid:${String(row.slug)}:${error instanceof Error ? error.message : ""}`);
      }
    }

    return { courses, complete: true };
  } catch {
    return { courses: [], complete: false };
  }
}

const cachedAll = unstable_cache(readAll, ["lms-live-courses"], {
  tags: [COURSE_LIST_TAG],
  revalidate: REVALIDATE_SECONDS,
});

/**
 * Every course, live, with any snapshot course the database has never heard of
 * merged in behind it — same rule as the single read, applied to a list.
 */
export async function listLiveCourses(): Promise<Course[]> {
  const { courses, complete } = await cachedAll();
  if (!complete) {
    console.warn("lms_live_list_unavailable — serving the shipped snapshot");
    return snapshotCourses();
  }

  const live = new Set(courses.map((course) => course.slug));
  const missing = snapshotCourses().filter((course) => !live.has(course.slug));
  return [...courses, ...missing];
}
