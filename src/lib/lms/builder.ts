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
import { getSnapshotCourse } from "./catalog";
import { immediatePublishedPatch } from "./publishedEditPolicy";
import {
  courseReadiness,
  newCourseFromTemplate,
  preparePortableCourse,
  slugify,
  uniqueSlug,
  validateCourse,
  type Course,
  type CourseTheme,
  type IdSource,
  type PortableCoursePreview,
} from "@/lms-core";

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
  /** Card face for the grid view — the author's own image, when they set one. */
  cover: { src: string; alt: string } | null;
  theme: CourseTheme | null;
  sortOrder: number | null;
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
): Promise<{
  course: Course;
  /** The relational release currently served to learners. */
  liveCourse: Course;
  authorId: string | null;
  updatedAt: string | null;
  reviewStatus: CourseReviewStatus;
  reviewNote: string | null;
  reviewEnabled: boolean;
  /** The stable release stays live while `course` is its next working version. */
  liveStatus: Course["status"];
  hasPendingRevision: boolean;
  revisionEnabled: boolean;
} | null> {
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

  const liveCourse = courseFromRows(courseRow, (moduleRows ?? []) as CourseRow[], (lessonRows ?? []) as CourseRow[]);
  const pendingContent = courseRow.pending_content;
  const hasPendingRevision = pendingContent !== null && pendingContent !== undefined;
  let course = liveCourse;
  if (hasPendingRevision) {
    validateCourse(pendingContent, "pending_revision");
    course = pendingContent as Course;
  }

  return {
    course,
    liveCourse,
    authorId: (courseRow.author_id as string | null) ?? null,
    updatedAt: (courseRow.updated_at as string | null) ?? null,
    reviewStatus: hasPendingRevision
      ? ((courseRow.pending_review_status as CourseReviewStatus | undefined) ?? "draft")
      : ((courseRow.review_status as CourseReviewStatus | undefined) ?? (courseRow.status === "published" ? "approved" : "draft")),
    reviewNote: hasPendingRevision
      ? ((courseRow.pending_review_note as string | null) ?? null)
      : ((courseRow.review_note as string | null) ?? null),
    reviewEnabled: "review_status" in courseRow,
    liveStatus: liveCourse.status,
    hasPendingRevision,
    revisionEnabled: "pending_content" in courseRow,
  };
}

export async function listBuilderCourses(filter: { authorId?: string }): Promise<BuilderCourseSummary[]> {
  const db = adminClient();
  let query = db.from("lms_courses").select("id, slug, title, status, author_id, updated_at, cover, theme, sort_order");
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
        cover: (row.cover as { src: string; alt: string } | null) ?? null,
        theme: (row.theme as CourseTheme | null) ?? null,
        sortOrder: row.sort_order === null || row.sort_order === undefined ? null : Number(row.sort_order),
      };
    })
  );

  // The author's own order first; anything they have never placed sorts after
  // it, alphabetically. A course that has no `sortOrder` is not "position 0" —
  // treating NULL as zero would push every untouched course to the top the
  // first time anyone reordered anything.
  return summaries.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      if (a.sortOrder === null) return 1;
      if (b.sortOrder === null) return -1;
      return a.sortOrder - b.sortOrder;
    }
    return a.title.localeCompare(b.title);
  });
}

export type SaveOutcome = {
  slug: string;
  status: Course["status"];
  blockers: ReturnType<typeof courseReadiness>["blockers"];
  staged?: boolean;
};

export type CourseReviewStatus = "draft" | "in_review" | "changes_requested" | "approved";

/**
 * A course address is mutable only while it is still an inert working draft.
 *
 * The database hangs modules, lessons, offers and sources from the course UUID,
 * so the row itself can be renamed safely. What cannot be renamed casually is
 * an address already sent to learners or used by a checkout. The server keeps
 * that boundary here rather than trusting the pencil's disabled state.
 */
export function courseSlugCanChange(input: {
  course: Pick<Course, "slug" | "status" | "visibility">;
  reviewStatus: CourseReviewStatus;
}): boolean {
  return input.course.status === "draft"
    && (input.course.visibility ?? "hidden") === "hidden"
    && input.reviewStatus === "draft"
    && getSnapshotCourse(input.course.slug) === null;
}

/** The UI promise includes the learner check; the pure predicate above stays
 * separate so lifecycle rules remain cheap to test without a database. */
export async function builderCourseSlugCanChange(input: {
  course: Pick<Course, "id" | "slug" | "status" | "visibility">;
  reviewStatus: CourseReviewStatus;
}): Promise<boolean> {
  if (!courseSlugCanChange(input)) return false;
  const { data, error } = await adminClient()
    .from("lms_enrollments")
    .select("id")
    .eq("course_id", input.course.id)
    .limit(1);
  if (error) throw new Error(`lms_builder_slug_check_failed:${error.message}`);
  return (data ?? []).length === 0;
}

export async function renameBuilderCourseSlug(currentSlug: string, requestedSlug: string): Promise<{ slug: string }> {
  const loaded = await loadBuilderCourse(currentSlug);
  if (!loaded) throw new Error("lms_builder_course_not_found");
  if (!await builderCourseSlugCanChange({ course: loaded.course, reviewStatus: loaded.reviewStatus })) {
    throw new Error("lms_builder_slug_locked");
  }

  const nextSlug = slugify(requestedSlug);
  if (nextSlug === currentSlug) return { slug: currentSlug };

  const db = adminClient();
  const { data: collision, error: collisionError } = await db
    .from("lms_courses")
    .select("id")
    .eq("slug", nextSlug)
    .maybeSingle();
  if (collisionError) throw new Error(`lms_builder_slug_check_failed:${collisionError.message}`);
  if (collision) throw new Error("lms_builder_slug_conflict");

  const programSlug = loaded.course.programSlug === currentSlug ? nextSlug : loaded.course.programSlug;
  const { error } = await db
    .from("lms_courses")
    .update({ slug: nextSlug, program_slug: programSlug })
    .eq("id", loaded.course.id);
  if (error) {
    if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
      throw new Error("lms_builder_slug_conflict");
    }
    throw new Error(`lms_builder_slug_write_failed:${error.message}`);
  }
  return { slug: nextSlug };
}

/**
 * The ownership boundary `writeCourseStructure` cannot enforce on its own.
 *
 * That function upserts modules and lessons by the `id` the payload declares
 * (`onConflict: "id"`), which is what makes a resubmit idempotent — and what
 * makes an id from someone else's course dangerous. Course A's author is
 * authorized because `existing.authorId` matched THEM, but nothing then
 * stopped their payload from naming a module or lesson id that belongs to
 * course B: the upsert would match that row by primary key and rewrite its
 * `course_id` to A, silently stealing it out of B. Every nested id in the
 * payload has to already belong to `ownerCourseId` (or not exist yet) before
 * a write is allowed to happen at all.
 */
async function assertNestedIdsAreOwned(
  db: ReturnType<typeof adminClient>,
  course: Course,
  ownerCourseId: string
): Promise<void> {
  const moduleIds = course.modules.map((module) => module.id);
  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));

  if (moduleIds.length > 0) {
    const { data, error } = await db.from("lms_modules").select("id, course_id").in("id", moduleIds);
    if (error) throw new Error(`lms_builder_ownership_check_failed:${error.message}`);
    for (const row of (data ?? []) as { id: string; course_id: string }[]) {
      if (row.course_id !== ownerCourseId) {
        throw new Error(`lms_authoring_id_conflict:module:${row.id}`);
      }
    }
  }

  if (lessonIds.length > 0) {
    const { data, error } = await db.from("lms_lessons").select("id, course_id").in("id", lessonIds);
    if (error) throw new Error(`lms_builder_ownership_check_failed:${error.message}`);
    for (const row of (data ?? []) as { id: string; course_id: string }[]) {
      if (row.course_id !== ownerCourseId) {
        throw new Error(`lms_authoring_id_conflict:lesson:${row.id}`);
      }
    }
  }
}

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

  const loaded = await loadBuilderCourse(incoming.slug);
  const existing = await readCourseRow(incoming.slug);
  const nextVersion = existing ? Number(existing.version ?? 1) + 1 : incoming.version;

  // The id this write is authorized for: the existing row's own id when
  // editing (the caller checked `canEditCourse` against THIS row), or the
  // payload's own id the one time a course is created fresh. Pinned onto the
  // outgoing course the same way route.ts pins the slug — a body cannot claim
  // a different top-level course id than the one just authorized either.
  const ownerCourseId = existing ? (existing.id as string) : incoming.id;

  const reviewEnabled = Boolean(existing && "review_status" in existing);
  if (reviewEnabled && incoming.status === "published" && existing?.review_status !== "approved") {
    throw new Error("lms_builder_review_required");
  }

  const db = adminClient();

  // Once a release exists, modules and lessons must never be written in place.
  // Learners keep the relational live release; the author works on one complete
  // next version stored beside it. The two explicitly presentational fields are
  // the only direct patch path, defined and tested in publishedEditPolicy.ts.
  if (loaded?.liveStatus === "published" && reviewEnabled) {
    if (!loaded.revisionEnabled) throw new Error("lms_builder_revision_migration_required");

    const direct = !loaded.hasPendingRevision ? immediatePublishedPatch(loaded.liveCourse ?? loaded.course, incoming) : null;
    if (direct) {
      const values: Record<string, unknown> = {
        cover: direct.cover,
        sort_order: direct.sortOrder,
        status: direct.status,
        version: nextVersion,
      };
      // Taking a course offline is an explicit release decision. It must not
      // retain the approval that applied to the previous public release.
      if (direct.status === "draft" && existing?.review_status !== "draft") {
        Object.assign(values, { review_status: "draft", review_note: null, submitted_at: null, approved_at: null, approved_by: null });
      }
      const { error } = await db.from("lms_courses").update(values).eq("id", ownerCourseId);
      if (error) throw new Error(`lms_builder_live_metadata_write_failed:${error.message}`);
      return { slug: incoming.slug, status: direct.status, blockers: courseReadiness(incoming).blockers };
    }

    const revision: Course = {
      ...incoming,
      id: loaded.liveCourse.id,
      slug: loaded.liveCourse.slug,
      programSlug: loaded.liveCourse.programSlug,
      status: "draft",
      visibility: loaded.liveCourse.visibility,
      version: Number(existing?.version ?? loaded.liveCourse.version) + 1,
    };
    await assertNestedIdsAreOwned(db, revision, ownerCourseId);
    const { error } = await db.from("lms_courses").update({
      pending_content: revision,
      pending_review_status: "draft",
      pending_review_note: null,
      pending_submitted_at: null,
      pending_updated_at: new Date().toISOString(),
    }).eq("id", ownerCourseId);
    if (error) throw new Error(`lms_builder_revision_write_failed:${error.message}`);
    return { slug: revision.slug, status: "draft", blockers: courseReadiness(revision).blockers, staged: true };
  }

  await assertNestedIdsAreOwned(db, incoming, ownerCourseId);

  // `StructureWriter` is the narrow shape authoring.ts needs, so it stays
  // testable without a Supabase client. The real client's builder is thenable
  // rather than a Promise, which satisfies the contract at runtime and not the
  // type — the same cast the CLI does implicitly by being untyped JS.
  const writer = db as unknown as Parameters<typeof writeCourseStructure>[0];
  const result = await writeCourseStructure(writer, {
    ...incoming,
    id: ownerCourseId,
    version: nextVersion,
    // Catalogue visibility is governed in admin, never accepted from an
    // authoring payload even if a stale client still sends it.
    visibility: (existing?.visibility as Course["visibility"] | undefined) ?? "hidden",
  });
  if (reviewEnabled && incoming.status === "draft" && existing?.review_status !== "draft") {
    const { error } = await db.from("lms_courses").update({
      review_status: "draft",
      review_note: null,
      submitted_at: null,
      approved_at: null,
      approved_by: null,
    }).eq("id", ownerCourseId);
    if (error) throw new Error(`lms_builder_review_reset_failed:${error.message}`);
  }
  return { slug: result.slug, status: result.status, blockers: result.blockers };
}

export async function submitBuilderCourseForReview(slug: string): Promise<void> {
  const loaded = await loadBuilderCourse(slug);
  if (!loaded) throw new Error("lms_builder_course_not_found");
  if (!courseReadiness(loaded.course).ready) throw new Error("lms_builder_not_ready_for_review");
  if (loaded.hasPendingRevision) {
    if (loaded.reviewStatus === "in_review") throw new Error("lms_builder_review_already_submitted");
    const { error } = await adminClient().from("lms_courses").update({
      pending_review_status: "in_review",
      pending_review_note: null,
      pending_submitted_at: new Date().toISOString(),
    }).eq("slug", slug);
    if (error) throw new Error(`lms_builder_review_submit_failed:${error.message}`);
    return;
  }
  if (loaded.course.status !== "draft") throw new Error("lms_builder_review_published");
  const db = adminClient();
  const { error } = await db.from("lms_courses").update({
    review_status: "in_review",
    review_note: null,
    submitted_at: new Date().toISOString(),
    approved_at: null,
    approved_by: null,
  }).eq("slug", slug);
  if (error) throw new Error(`lms_builder_review_submit_failed:${error.message}`);
}

/**
 * Creates a course from nothing.
 *
 * The one write in the builder that does NOT go through `saveBuilderCourse`
 * first — because that function reads the existing row to decide the version
 * and the owning id, and there is no existing row. What it does instead is
 * hand the same `writeCourseStructure` a course built from a TEMPLATE, so a
 * course born here is validated by the same validator as one imported from a
 * file, and comes into the world as a draft whose every hole is marked.
 *
 * Ownership is set at creation and never guessed later. `author_id` is the
 * person who pressed the button — including an admin, who can hand it over
 * afterwards. A course created with `author_id = NULL` would be a "house
 * course" nobody can see but an admin, which is the state both shipped
 * courses are in and precisely the thing that needed an UPDATE by hand.
 */
export async function createBuilderCourse(input: {
  title?: string;
  authorId: string;
  template?: string;
  theme?: CourseTheme;
  ids: () => string;
}): Promise<{ slug: string }> {
  const db = adminClient();
  const requestedTitle = input.title?.trim();

  // Two tabs may create a draft at the same time. The unique slug constraint is
  // the final arbiter; on a collision we re-read and advance the default name.
  // This keeps the interaction one-click without ever overwriting another
  // author's "Новий курс".
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: existingRows, error: listError } = await db.from("lms_courses").select("slug, title");
    if (listError) throw new Error(`lms_builder_list_failed:${listError.message}`);
    const existing = (existingRows ?? []) as { slug: string; title: string }[];
    const title = requestedTitle || nextDraftTitle(existing.map((row) => row.title));
    // Default titles are Ukrainian prose; the address is a temporary working
    // key, not a transliteration exercise. A short random suffix stays legible,
    // avoids collisions and is explicitly editable before first release.
    const slug = uniqueSlug(`new-course-${input.ids().replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase()}`, existing.map((row) => row.slug));

    const course = newCourseFromTemplate(input.ids, {
      slug,
      title,
      // A course is its own program before it is a catalogue item. The stable
      // program identity is born here; visibility/listing is a later admin
      // decision and never a prerequisite for authoring.
      programSlug: slug,
      template: input.template,
      ...(input.theme ? { theme: input.theme } : {}),
    });

    try {
      const writer = db as unknown as Parameters<typeof writeCourseStructure>[0];
      await writeCourseStructure(writer, course);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate key") && !message.includes("unique constraint")) throw error;
      continue;
    }

    const { error } = await db.from("lms_courses").update({ author_id: input.authorId }).eq("id", course.id);
    if (error) throw new Error(`lms_builder_author_write_failed:${error.message}`);
    return { slug: course.slug };
  }

  throw new Error("lms_builder_create_conflict");
}

export function nextDraftTitle(titles: Iterable<string>, base = "Новий курс"): string {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}(?: (\\d+))?$`, "i");
  let highest = 0;
  for (const title of titles) {
    const match = title.trim().match(pattern);
    if (!match) continue;
    highest = Math.max(highest, match[1] ? Number(match[1]) : 1);
  }
  return highest === 0 ? base : `${base} ${highest + 1}`;
}

/**
 * Validates an exported course and prepares the exact draft that an import
 * would create. This is read-only: the Builder can show the real slug and
 * readiness result before the author allows a write.
 *
 * Slugs are read without the author's filter. A collision with somebody
 * else's hidden course is still a collision in the database, even though the
 * caller is not allowed to learn that course's title or contents.
 */
export async function previewBuilderCourseImport(input: unknown, ids: IdSource): Promise<PortableCoursePreview> {
  const db = adminClient();
  const { data, error } = await db.from("lms_courses").select("slug");
  if (error) throw new Error(`lms_builder_list_failed:${error.message}`);
  const takenSlugs = ((data ?? []) as { slug: string }[]).map((row) => row.slug);
  return preparePortableCourse(input, { takenSlugs, ids });
}

/** Write a previewed portable course and assign it to the importing account. */
export async function importBuilderCourse(course: Course, authorId: string): Promise<{ slug: string }> {
  // The route only passes a course produced by `previewBuilderCourseImport`,
  // but keep the write boundary self-defending: an internal caller must not be
  // able to turn this into a back door for importing something published.
  validateCourse(course, "builder.import");
  if (course.status !== "draft" || course.visibility !== "hidden" || course.entitlementProductCodes.length > 0) {
    throw new Error("lms_builder_import_not_inert");
  }

  const db = adminClient();
  const writer = db as unknown as Parameters<typeof writeCourseStructure>[0];
  await writeCourseStructure(writer, course);

  const { error } = await db.from("lms_courses").update({ author_id: authorId }).eq("id", course.id);
  if (error) throw new Error(`lms_builder_author_write_failed:${error.message}`);
  return { slug: course.slug };
}

/**
 * Deletes a course — with three refusals that are not negotiable from the UI.
 *
 * A published course is refused: unpublishing is one press and reversible,
 * deleting is neither, and an author who meant "take it down" must not be able
 * to reach "erase it" by pressing the wrong red thing once.
 *
 * A course any learner has ever touched is refused outright. `lms_progress_events`
 * cascades from lessons, so deleting the course would erase the history of
 * everyone who walked it, silently and with no way back. That is not a
 * confirmation dialog's decision to make; a course with learners gets
 * unpublished and archived, not removed.
 *
 * A course with a checked-in snapshot (`data/courses/*.json`) is refused too.
 * `liveCatalog.ts`'s absent-row branch exists to survive a seeding mistake —
 * deleting the row is supposed to mean "this course never happened", but for a
 * snapshot-backed slug it instead means "reactivate the file", the moment the
 * row disappears and the fallback takes over. Retiring one of these for real
 * is a git change (delete the JSON, `lms:pull` has nothing left to protect),
 * not a database delete.
 */
export async function deleteBuilderCourse(slug: string): Promise<void> {
  const db = adminClient();

  const row = await readCourseRow(slug);
  if (!row) throw new Error(`lms_builder_unknown_course:${slug}`);
  if (row.status === "published") throw new Error(`lms_builder_delete_published:${slug}`);
  if (getSnapshotCourse(slug)) throw new Error(`lms_builder_delete_has_snapshot:${slug}`);

  const courseId = row.id as string;
  const { data: enrollments, error: enrollmentError } = await db
    .from("lms_enrollments")
    .select("id")
    .eq("course_id", courseId)
    .limit(1);
  if (enrollmentError) throw new Error(`lms_builder_delete_check_failed:${enrollmentError.message}`);
  if ((enrollments ?? []).length > 0) throw new Error(`lms_builder_delete_has_learners:${slug}`);

  const { data: lessons, error: lessonError } = await db.from("lms_lessons").select("id").eq("course_id", courseId);
  if (lessonError) throw new Error(`lms_builder_delete_check_failed:${lessonError.message}`);
  const lessonIds = ((lessons ?? []) as { id: string }[]).map((lesson) => lesson.id);

  if (lessonIds.length > 0) {
    const { data: touched, error: progressError } = await db
      .from("lms_progress_events")
      .select("lesson_id")
      .in("lesson_id", lessonIds)
      .limit(1);
    if (progressError) throw new Error(`lms_builder_delete_check_failed:${progressError.message}`);
    if ((touched ?? []).length > 0) throw new Error(`lms_builder_delete_has_learners:${slug}`);
  }

  // Modules and lessons cascade from the course row (see the foundation
  // migration), so one delete is the whole thing.
  const { error } = await db.from("lms_courses").delete().eq("id", courseId);
  if (error) throw new Error(`lms_builder_delete_failed:${error.message}`);
}

/**
 * Writes the author's own order for their shelf.
 *
 * Positions are rewritten wholesale from the list the client sends, rather than
 * patched one row at a time, because "move this card up" is a statement about
 * the whole sequence: a single-row update leaves two cards claiming the same
 * position, and the list then sorts by whatever `title.localeCompare` decides.
 *
 * Every slug is checked against what this identity may edit BEFORE anything is
 * written — a payload that names a course the caller does not own would
 * otherwise reorder someone else's shelf.
 */
export async function reorderBuilderCourses(slugs: string[], allowed: (slug: string) => boolean): Promise<void> {
  const unauthorized = slugs.filter((slug) => !allowed(slug));
  if (unauthorized.length > 0) throw new Error(`lms_builder_reorder_forbidden:${unauthorized[0]}`);

  const db = adminClient();
  for (let index = 0; index < slugs.length; index += 1) {
    const { error } = await db.from("lms_courses").update({ sort_order: index + 1 }).eq("slug", slugs[index]);
    if (error) throw new Error(`lms_builder_reorder_failed:${error.message}`);
  }
}
