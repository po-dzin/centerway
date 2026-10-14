/**
 * A portable course is the same `Course` JSON the CLI snapshots and imports.
 *
 * Importing is deliberately a COPY operation, never an upsert of the ids a
 * foreign file declares. The file may have come from another environment (or
 * be an older export of this one), so trusting its row ids would let it rewrite
 * an existing course. Every identity is minted again and every import starts as
 * a hidden draft with no commerce binding.
 */

import { validateCourse, type Course } from "./course";
import { courseReadiness, type CourseReadiness } from "./readiness";
import { uniqueSlug, type IdSource } from "./drafts";
import type { LessonBlock } from "./blocks";
import { isRecord } from "./inline";
import { slugify } from "./drafts";
import { parseInternalReference, internalReferenceKey } from "./references";
import { COURSE_TITLE_MAX, COURSE_TITLE_RAW_MAX } from "./course";
import { courseTitleName } from "./title";

export type PortableCoursePreview = {
  course: Course;
  readiness: CourseReadiness;
  summary: {
    sourceSlug: string;
    slug: string;
    title: string;
    locale: Course["locale"];
    moduleCount: number;
    lessonCount: number;
    blockCount: number;
  };
};

function replacementId(source: unknown, ids: IdSource, identities: Map<string, string>): string {
  const next = ids();
  if (typeof source === "string") identities.set(source, next);
  return next;
}

function remapReferences<T>(value: T, identities: Map<string, string>): T {
  const walk = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(walk);
    if (!isRecord(item)) return item;
    return Object.fromEntries(
      Object.entries(item).map(([key, child]) => {
        if (key === "href" && typeof child === "string") {
          const ref = parseInternalReference(child);
          if (ref)
            return [
              key,
              internalReferenceKey(
                ref.kind === "lesson"
                  ? { ...ref, lessonId: identities.get(ref.lessonId) ?? ref.lessonId }
                  : {
                      ...ref,
                      lessonId: identities.get(ref.lessonId) ?? ref.lessonId,
                      blockId: identities.get(ref.blockId) ?? ref.blockId,
                    },
              ),
            ];
        }
        return [key, walk(child)];
      }),
    );
  };
  return walk(value) as T;
}

/** Fill identities only; authored content still passes the ordinary validator. */
function normalizeBlock(input: unknown, ids: IdSource, identities: Map<string, string>): unknown {
  if (!isRecord(input)) return input;
  const block: Record<string, unknown> = { ...input, id: replacementId(input.id, ids, identities) };
  if (block.type === "group" && Array.isArray(block.children)) {
    block.children = block.children.map((child) => normalizeBlock(child, ids, identities));
  }
  if ((block.type === "checklist" || block.type === "faq_block") && Array.isArray(block.items)) {
    block.items = block.items.map((item) => (isRecord(item) ? { ...item, id: ids() } : item));
  }
  return block;
}

/**
 * `{ "course": {…} }` is the import request's own envelope, and a file saved
 * from it (or written by someone copying the request) carries it. A course
 * has no `course` key of its own, so unwrapping cannot misread one.
 */
function unwrapCourse(input: unknown): unknown {
  if (isRecord(input) && isRecord(input.course) && input.modules === undefined) return input.course;
  return input;
}

/**
 * «Назва: підзаголовок» is how a document heading is usually written, but only
 * a spaced dash splits a title in two. When the name would be too long as it
 * stands and the colon cuts it to a fitting one, the colon becomes « — ». The
 * words are the author's own; only the separator changes, and the import says so.
 */
export function splitColonTitle(title: unknown): string | null {
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  if (courseTitleName(trimmed).length <= COURSE_TITLE_MAX || trimmed.length > COURSE_TITLE_RAW_MAX) return null;
  const at = trimmed.indexOf(": ");
  if (at <= 0 || /\s[—–-]\s/u.test(trimmed)) return null;
  const name = trimmed.slice(0, at).trim();
  const tail = trimmed.slice(at + 2).trim();
  if (!name || !tail || name.length > COURSE_TITLE_MAX) return null;
  return `${name} — ${tail}`;
}

/** What `normalizePortableCourse` changed in the author's words, for the preview. */
export function portableImportNotes(raw: unknown): string[] {
  const input = unwrapCourse(raw);
  if (!isRecord(input)) return [];
  const split = splitColonTitle(input.title);
  return split ? [`Назву розділено на назву й підзаголовок: «${split}».`] : [];
}

export function normalizePortableCourse(raw: unknown, ids: IdSource): unknown {
  const input = unwrapCourse(raw);
  if (!isRecord(input)) return input;
  const splitTitle = splitColonTitle(input.title);
  const identities = new Map<string, string>();
  const slug = input.slug ?? (typeof input.title === "string" ? slugify(input.title) : undefined);
  const lessonsTaken = new Set<string>();
  const modulesTaken = new Set<string>();
  // A daily course needs a day on every lesson outside reference modules. A
  // file that leaves days out means «in the order written», so they are
  // counted on from the highest day the file does name.
  const schedule = input.schedule ?? { mode: "open" };
  const daily = isRecord(schedule) && schedule.mode === "daily";
  let nextDay = Array.isArray(input.modules)
    ? input.modules
        .flatMap((module) => (isRecord(module) && Array.isArray(module.lessons) ? module.lessons : []))
        .reduce<number>(
          (max, lesson) =>
            isRecord(lesson) && typeof lesson.dayIndex === "number" ? Math.max(max, lesson.dayIndex) : max,
          0,
        )
    : 0;
  const course: Record<string, unknown> = {
    ...input,
    ...(splitTitle ? { title: splitTitle } : {}),
    id: ids(),
    slug,
    translationGroupId: ids(),
    status: "draft",
    version: 1,
    entitlementProductCodes: [],
    visibility: "hidden",
    programSlug: input.programSlug ?? slug,
    brand: input.brand ?? "centerway",
    locale: input.locale ?? "uk",
    schedule,
    modules: Array.isArray(input.modules)
      ? input.modules.map((module, index) => {
          if (!isRecord(module)) return module;
          const moduleSlug =
            module.slug ?? (typeof module.title === "string" ? uniqueSlug(module.title, modulesTaken) : undefined);
          if (typeof moduleSlug === "string") modulesTaken.add(moduleSlug);
          return {
            ...module,
            id: replacementId(module.id, ids, identities),
            slug: moduleSlug,
            order: module.order ?? index + 1,
            lessons: Array.isArray(module.lessons)
              ? module.lessons.map((lesson, lessonIndex) => {
                  if (!isRecord(lesson)) return lesson;
                  const lessonSlug =
                    lesson.slug ??
                    (typeof lesson.title === "string" ? uniqueSlug(lesson.title, lessonsTaken) : undefined);
                  if (typeof lessonSlug === "string") lessonsTaken.add(lessonSlug);
                  return {
                    ...lesson,
                    id: replacementId(lesson.id, ids, identities),
                    slug: lessonSlug,
                    order: lesson.order ?? lessonIndex + 1,
                    ...(daily && module.reference !== true && lesson.dayIndex === undefined
                      ? { dayIndex: ++nextDay }
                      : {}),
                    blocks: Array.isArray(lesson.blocks)
                      ? lesson.blocks.map((block) => normalizeBlock(block, ids, identities))
                      : lesson.blocks,
                  };
                })
              : module.lessons,
          };
        })
      : input.modules,
  };
  delete course.sortOrder;
  return remapReferences(course, identities);
}

function contentKey(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) =>
    key === "id"
      ? undefined
      : isRecord(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
  );
}

/** Preserve progress-bearing identities only for unchanged authored content. */
function retainBlockIds(blocks: LessonBlock[], previous: LessonBlock[]): LessonBlock[] {
  const unused = [...previous];
  return blocks.map((block) => {
    const index = unused.findIndex((old) => contentKey(old) === contentKey(block));
    const old = index >= 0 ? unused.splice(index, 1)[0] : undefined;
    if (!old) return block;
    if (block.type === "group" && old.type === "group")
      return { ...block, id: old.id, children: retainBlockIds(block.children, old.children) };
    if (
      (block.type === "checklist" && old.type === "checklist") ||
      (block.type === "faq_block" && old.type === "faq_block")
    )
      return {
        ...block,
        id: old.id,
        items: block.items.map((item, index) => ({ ...item, id: old.items[index]!.id })),
      } as LessonBlock;
    return { ...block, id: old.id };
  });
}

/** Match stable route keys; foreign file ids never authorize a write. */
export function portableCourseUpdate(imported: Course, target: Course): Course {
  const course: Course = {
    ...imported,
    id: target.id,
    slug: target.slug,
    programSlug: target.programSlug,
    translationGroupId: target.translationGroupId,
    entitlementProductCodes: target.entitlementProductCodes,
    visibility: target.visibility,
    sortOrder: target.sortOrder,
    version: target.version,
    modules: imported.modules.map((module) => {
      const oldModule = target.modules.find((old) => old.slug === module.slug);
      return {
        ...module,
        id: oldModule?.id ?? module.id,
        lessons: module.lessons.map((lesson) => {
          const oldLesson = target.modules.flatMap((old) => old.lessons).find((old) => old.slug === lesson.slug);
          return {
            ...lesson,
            id: oldLesson?.id ?? lesson.id,
            blocks: oldLesson ? retainBlockIds(lesson.blocks, oldLesson.blocks) : lesson.blocks,
          };
        }),
      };
    }),
  };
  const identities = new Map<string, string>();
  const collect = (before: LessonBlock[], after: LessonBlock[]) =>
    before.forEach((block, index) => {
      const next = after[index]!;
      identities.set(block.id, next.id);
      if (block.type === "group" && next.type === "group") collect(block.children, next.children);
    });
  imported.modules.forEach((module, mi) =>
    module.lessons.forEach((lesson, li) => {
      const next = course.modules[mi]!.lessons[li]!;
      identities.set(lesson.id, next.id);
      collect(lesson.blocks, next.blocks);
    }),
  );
  const remapped = remapReferences(course, identities);
  validateCourse(remapped, "portable.update");
  return remapped;
}

/**
 * Validate and turn an exported course into a new, inert Builder draft.
 *
 * Technical identities are generated before validation; authored content is
 * never invented. Existing exports and minimal author-written JSON share this boundary.
 */
export function preparePortableCourse(
  input: unknown,
  options: { takenSlugs: Iterable<string>; ids: IdSource },
): PortableCoursePreview {
  const normalized = normalizePortableCourse(input, options.ids);
  validateCourse(normalized, "portable");
  const source = normalized;

  const course: Course = {
    ...source,
    id: options.ids(),
    slug: uniqueSlug(source.slug, options.takenSlugs),
    translationGroupId: options.ids(),
    status: "draft",
    version: 1,
    entitlementProductCodes: [],
    visibility: "hidden",
    modules: source.modules,
  };
  delete course.sortOrder;

  // Prove the normalized copy satisfies the same contract before a caller can
  // show a preview or write it. Readiness blockers are allowed on drafts and
  // are part of the preview rather than an import failure.
  validateCourse(course, "portable.draft");
  const readiness = courseReadiness(course);
  const lessons = course.modules.flatMap((module) => module.lessons);

  return {
    course,
    readiness,
    summary: {
      sourceSlug: source.slug,
      slug: course.slug,
      title: course.title,
      locale: course.locale,
      moduleCount: course.modules.length,
      lessonCount: lessons.length,
      blockCount: lessons.reduce((count, lesson) => count + lesson.blocks.length, 0),
    },
  };
}

export type PortableIssue = { error: string; context?: string };

const COURSE_KEY_BY_CODE: Record<string, string> = {
  lms_course_invalid_tagline: "tagline",
  lms_course_invalid_pretitle: "pretitle",
  lms_course_pretitle_too_long: "pretitle",
  lms_course_invalid_kind: "kind",
  lms_course_invalid_categories: "categories",
  lms_course_duplicate_categories: "categories",
  lms_course_too_many_categories: "categories",
  lms_course_invalid_duration_days: "durationDays",
  lms_course_invalid_results: "results",
  lms_course_invalid_audience: "audience",
  lms_course_invalid_format: "format",
  lms_course_invalid_accessnote: "accessNote",
  lms_course_invalid_authornote: "authorNote",
  lms_course_invalid_visibility: "visibility",
  lms_course_invalid_cover: "cover",
  lms_course_cover_missing_src: "cover",
  lms_course_cover_missing_alt: "cover",
  lms_course_invalid_cover_mobile_src: "cover",
  lms_course_invalid_cover_crop: "cover",
};

const ISSUES_MAX = 40;

/**
 * Every problem in a file, not just the first.
 *
 * The validator stops at the first failure, so an author fixing a file one
 * error per upload (or one error per round trip through a chat) never learns
 * how far from valid it is. This walks the same validator repeatedly on a
 * scratch copy, noting each failure and replacing only the offending block,
 * lesson, module or optional field with an inert stand-in so the next one can
 * surface. The stand-ins never leave this function: nothing here is imported.
 */
export function collectPortableIssues(raw: unknown, ids: IdSource = () => `probe-${Math.random()}`): PortableIssue[] {
  const work = structuredClone(normalizePortableCourse(raw, ids)) as Record<string, unknown>;
  if (!isRecord(work)) return [];
  const issues: PortableIssue[] = [];
  const seen = new Set<string>();

  for (let pass = 0; pass < ISSUES_MAX; pass++) {
    let error: string;
    try {
      validateCourse(work, "portable");
      return issues;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "";
    }
    if (!error.startsWith("lms_") || seen.has(error)) {
      if (error && !seen.has(error)) issues.push({ error });
      return issues;
    }
    seen.add(error);
    const [code = ""] = error.split(":");
    const path = error.slice(code.length + 1);
    const at = (name: string) => {
      const found = new RegExp(`${name}\\[(\\d+)\\]`).exec(path);
      return found ? Number(found[1]) : undefined;
    };
    const mi = at("modules");
    const li = at("lessons");
    const bi = at("blocks");
    const modules = Array.isArray(work.modules) ? (work.modules as Record<string, unknown>[]) : [];
    const courseModule = mi === undefined ? undefined : modules[mi];
    const lessons =
      courseModule && Array.isArray(courseModule.lessons) ? (courseModule.lessons as Record<string, unknown>[]) : [];
    const lesson = li === undefined ? undefined : lessons[li];
    const standIn = () => ({
      id: ids(),
      type: "rich_text",
      content: [{ kind: "p", text: "-" }],
    });

    if (code === "lms_course_title_too_long") {
      const title = String(work.title ?? "");
      const name = courseTitleName(title);
      issues.push({
        error,
        context:
          name.length > COURSE_TITLE_MAX
            ? `Зараз назва має ${name.length} символів (ліміт ${COURSE_TITLE_MAX}).`
            : `Зараз назва разом із підзаголовком має ${title.trim().length} символів (ліміт ${COURSE_TITLE_RAW_MAX}).`,
      });
      work.title = "Курс";
    } else if (COURSE_KEY_BY_CODE[code] && mi === undefined) {
      issues.push({ error });
      delete work[COURSE_KEY_BY_CODE[code]!];
    } else if (lesson && bi !== undefined && Array.isArray(lesson.blocks) && lesson.blocks[bi] !== undefined) {
      issues.push({ error });
      (lesson.blocks as unknown[])[bi] = standIn();
    } else if (lesson && courseModule) {
      issues.push({ error });
      lessons[li!] = {
        ...lesson,
        slug: `probe-${mi}-${li}-${pass}`,
        ...(typeof lesson.title === "string" && lesson.title.trim() ? {} : { title: "-" }),
        ...(code === "lms_lesson_missing_day_index" ? { dayIndex: 900 + pass } : {}),
        blocks: [standIn()],
      };
    } else if (courseModule) {
      issues.push({ error });
      modules[mi!] = {
        ...courseModule,
        slug: `probe-${mi}-${pass}`,
        lessons: [{ ...(isRecord(lessons[0]) ? lessons[0] : {}), blocks: [standIn()] }],
      };
    } else {
      issues.push({ error });
      return issues;
    }
  }
  return issues;
}
