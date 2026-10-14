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

export function normalizePortableCourse(raw: unknown, ids: IdSource): unknown {
  const input = unwrapCourse(raw);
  if (!isRecord(input)) return input;
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
