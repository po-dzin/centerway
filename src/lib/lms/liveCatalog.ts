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
 * THE THREE ANSWERS, and the middle one is the one that changed:
 *
 *   · the row EXISTS      → serve it, whatever its status. Draft included: a
 *     draft is how staff and manual-grant holders preview, and `server.ts`
 *     already owns that gate. This is also what makes unpublishing work — the
 *     row stays and turns `draft`, and the gate closes.
 *   · the row is ABSENT   → the course does not exist. Answer nothing.
 *   · the read FAILED     → serve the snapshot, and say so in the log. This is
 *     the case, and now the ONLY case, the fallback was built for.
 *
 * THE ABSENT BRANCH USED TO SERVE THE SNAPSHOT, AND THAT WAS TOO AGGRESSIVE
 * (2026-08-29). The reasoning was that a course in git and missing from the
 * database is a seeding mistake, and a mistake must not take a paid course away
 * from the people in it. True — but "the row is gone" is far more often a
 * deliberate delete than a seeding accident, and the branch could not tell them
 * apart. So the file stopped being a backup and became an authority: it
 * OVERRODE a deletion, silently republishing a course the owner had removed,
 * and the only defence available was to forbid the deletion outright. Four
 * slugs were undeletable in the builder for no reason an author could see.
 *
 * A backup answers when the source cannot. It does not answer when the source
 * says "no". Absent now means absent, which is what lets
 * `deleteBuilderCourse` be about the course rather than about the file
 * underneath it. What still protects a paid learner is the gate that always
 * did: a course with enrolments is refused, snapshot or not.
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
  // A course the database does not have is a course that does not exist. The
  // snapshot is not consulted here — see the note at the top of this file.
  if (read.kind === "absent") return null;

  // Loud, because a learner is being served yesterday's copy and the reason
  // is infrastructure, not content.
  console.warn(`lms_live_course_unavailable:${slug}:${read.reason} — serving the shipped snapshot`);
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
 * Every course, live. The snapshot answers only when the read itself failed —
 * same rule as the single read, applied to a list.
 *
 * It used to merge in every snapshot course the database had never heard of,
 * which is the list-shaped version of the absent-row branch removed above: a
 * course deleted from the database came back onto the shelf on the next
 * request, from a file.
 */
export async function listLiveCourses(): Promise<Course[]> {
  const { courses, complete } = await cachedAll();
  if (!complete) {
    console.warn("lms_live_list_unavailable — serving the shipped snapshot");
    return snapshotCourses();
  }

  return courses;
}
