/**
 * The builder's data layer: read a course out of the database, write it back
 * through the one authoring service.
 *
 * SOURCE OF TRUTH, honestly. `docs/lms-authoring-pipeline-2026-08-19.md` settles
 * this as "database is the source, git is the export", with the switch triggered
 * by the first course someone else authors. That switch has NOT happened here:
 * `catalog.ts` still reads `data/courses/*.json`, so what a learner sees is what
 * shipped in the last deploy.
 *
 * So the builder reads and writes the DATABASE, and says so in the interface
 * rather than pretending. Two reasons not to flip the catalog in the same pass:
 *
 *   * the learner path is currently infallible — a static import that cannot
 *     fail at request time — and making it a database read is a change with
 *     production risk that deserves its own wave, not a side effect of shipping
 *     an editor;
 *   * the trigger the doc names has not fired. Both courses are house-owned.
 *
 * What that costs the author is one sentence of truth in the publish panel and
 * `npm run lms:pull` in the release. What flipping it blind would have cost is
 * every lesson request depending on a database that used to be irrelevant to it.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { courseFromRows, writeCourseStructure } from "./authoring";
import { getCourse } from "./catalog";
import { courseReadiness, validateCourse, type Course } from "@/lms-core";

export type BuilderCourseSummary = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  authorId: string | null;
  moduleCount: number;
  lessonCount: number;
  blockerCount: number;
  updatedAt: string | null;
};

type CourseRow = Record<string, unknown>;

async function readCourseRow(slug: string): Promise<CourseRow | null> {
  const db = adminClient();
  const { data, error } = await db.from("lms_courses").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`lms_builder_course_read_failed:${error.message}`);
  return (data as CourseRow | null) ?? null;
}

/**
 * The full authored course, rebuilt from rows.
 *
 * Returns `null` for a course that has no rows yet — which is a real state:
 * `lms:seed` mirrors a file into the database, and a course authored in git but
 * never seeded exists in one place and not the other.
 */
export async function loadBuilderCourse(
  slug: string
): Promise<{ course: Course; authorId: string | null; updatedAt: string | null } | null> {
  const courseRow = await readCourseRow(slug);
  if (!courseRow) return null;

  const db = adminClient();
  const courseId = courseRow.id as string;

  const [{ data: moduleRows, error: moduleError }, { data: lessonRows, error: lessonError }] = await Promise.all([
    db.from("lms_modules").select("*").eq("course_id", courseId),
    db.from("lms_lessons").select("*").eq("course_id", courseId),
  ]);

  if (moduleError) throw new Error(`lms_builder_modules_read_failed:${moduleError.message}`);
  if (lessonError) throw new Error(`lms_builder_lessons_read_failed:${lessonError.message}`);

  // `reference` is a JSON-only flag with no column (see courseFromRows). The
  // builder cannot recover it from the database, so a reference module read
  // here and written straight back would silently lose the flag and drop the
  // module into the numbered flow. Carried across from the shipped file.
  const referenceSlugs = referenceModuleSlugs(courseRow.slug as string);

  return {
    course: courseFromRows(courseRow, (moduleRows ?? []) as CourseRow[], (lessonRows ?? []) as CourseRow[], referenceSlugs),
    authorId: (courseRow.author_id as string | null) ?? null,
    updatedAt: (courseRow.updated_at as string | null) ?? null,
  };
}

/**
 * Reference-module slugs, from the shipped catalog.
 *
 * A stopgap with a real expiry: it goes away the moment `reference` becomes a
 * column, which is the right fix and belongs with the source-of-truth switch.
 * Until then this is the only place that knows, and a course the builder
 * created from scratch simply has none.
 */
function referenceModuleSlugs(slug: string): string[] {
  const shipped = getCourse(slug);
  return shipped ? shipped.modules.filter((module) => module.reference).map((module) => module.slug) : [];
}

export async function listBuilderCourses(filter: { authorId?: string }): Promise<BuilderCourseSummary[]> {
  const db = adminClient();
  let query = db.from("lms_courses").select("id, slug, title, status, author_id, updated_at");
  if (filter.authorId) query = query.eq("author_id", filter.authorId);

  const { data, error } = await query;
  if (error) throw new Error(`lms_builder_list_failed:${error.message}`);

  const rows = (data ?? []) as CourseRow[];
  if (rows.length === 0) return [];

  const courseIds = rows.map((row) => row.id as string);
  const [{ data: moduleRows }, { data: lessonRows }] = await Promise.all([
    db.from("lms_modules").select("id, course_id").in("course_id", courseIds),
    db.from("lms_lessons").select("id, course_id").in("course_id", courseIds),
  ]);

  const countBy = (source: CourseRow[] | null | undefined) => {
    const counts = new Map<string, number>();
    for (const row of source ?? []) {
      const key = row.course_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };

  const moduleCounts = countBy(moduleRows as CourseRow[] | null);
  const lessonCounts = countBy(lessonRows as CourseRow[] | null);

  // Blocker counts need the whole course, so they are loaded one at a time.
  // Fine at this scale — the list is a handful of rows for one author — and the
  // count is the single most useful thing on the card: it is the answer to
  // "what is still stopping me from publishing this".
  const summaries = await Promise.all(
    rows.map(async (row) => {
      const slug = row.slug as string;
      let blockerCount = 0;
      try {
        const loaded = await loadBuilderCourse(slug);
        blockerCount = loaded ? courseReadiness(loaded.course).blockers.length : 0;
      } catch {
        // A course whose rows do not currently form a valid structure must not
        // take the whole list down with it — it is exactly the course its author
        // most needs to be able to open.
        blockerCount = -1;
      }

      return {
        id: row.id as string,
        slug,
        title: row.title as string,
        status: row.status as "draft" | "published",
        authorId: (row.author_id as string | null) ?? null,
        moduleCount: moduleCounts.get(row.id as string) ?? 0,
        lessonCount: lessonCounts.get(row.id as string) ?? 0,
        blockerCount,
        updatedAt: (row.updated_at as string | null) ?? null,
      };
    })
  );

  return summaries.sort((a, b) => a.title.localeCompare(b.title));
}

export type SaveOutcome = {
  slug: string;
  status: Course["status"];
  blockers: ReturnType<typeof courseReadiness>["blockers"];
};

/**
 * Saves an edited course.
 *
 * Everything the builder writes goes through `writeCourseStructure`, the same
 * function the CLI and (later) the agent call — so the builder cannot publish
 * something the seed would reject, and every error carries the same
 * `lms_*:path` code the author would see anywhere else.
 *
 * `version` is bumped here rather than in the UI: the field exists so clients
 * can cache lesson bodies hard, and leaving it to whoever is typing would mean
 * a cache that goes stale exactly when the content changed.
 */
export async function saveBuilderCourse(input: unknown): Promise<SaveOutcome> {
  validateCourse(input, "builder");
  const incoming = input as Course;

  const existing = await readCourseRow(incoming.slug);
  const nextVersion = existing ? Number(existing.version ?? 1) + 1 : incoming.version;

  // `StructureWriter` is the narrow shape authoring.ts needs, so it stays
  // testable without a Supabase client. The real client's builder is thenable
  // rather than a Promise, which satisfies the contract at runtime and not the
  // type — the same cast the CLI does implicitly by being untyped JS.
  const writer = adminClient() as unknown as Parameters<typeof writeCourseStructure>[0];
  const result = await writeCourseStructure(writer, { ...incoming, version: nextVersion });
  return { slug: result.slug, status: result.status, blockers: result.blockers };
}
