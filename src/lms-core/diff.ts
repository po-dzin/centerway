/**
 * CenterWay LMS core — ЧТО ИЗМЕНИЛОСЬ между двумя версиями курса.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * ЗАЧЕМ ЭТО СУЩЕСТВУЕТ. С 2026-09-07 журнал фиксирует точный документ, который
 * ушёл на проверку, и точный документ, который стал релизом. Этого достаточно,
 * чтобы ДОКАЗАТЬ факт, и недостаточно, чтобы его УВИДЕТЬ: два JSON по двадцать
 * уроков человек не сравнивает глазами. Пока разницу нельзя прочитать, вопрос
 * «автор переписал материал после того, как прошёл проверку?» формально имеет
 * ответ и практически не имеет.
 *
 * СЧИТАЕТСЯ ПО ЗАПРОСУ И НЕ ХРАНИТСЯ. Так решено в
 * docs/lms-course-version-history-2026-08-23.md: «diff is computed on demand and
 * is not stored as another source of truth». Сохранённая разница — это третья
 * копия содержания, которая начинает расходиться с двумя первыми.
 *
 * СРАВНЕНИЕ ПО id, А НЕ ПО ПОЗИЦИИ. У модулей, уроков и блоков стабильные id,
 * поэтому перемещение урока видно как перемещение, а не как «удалили там,
 * добавили тут». Позиционное сравнение на курсе из двадцати уроков превращает
 * один сдвиг в стену ложных изменений, в которой настоящая правка теряется.
 */

import type { LessonBlock } from "./blocks";
import type { Course, CourseModule, Lesson } from "./course";

/**
 * Поля курса, за изменением которых следят отдельно.
 *
 * `version` здесь нет намеренно: счётчик двигается на каждом сохранении и в
 * списке содержательных правок был бы шумом, который присутствует всегда. Той
 * же причины, по которой он исключён из отпечатка содержания в
 * `courseRevisionHash`.
 */
const COURSE_FIELDS = [
  "title",
  "summary",
  "tagline",
  "pretitle",
  "posttitle",
  "kind",
  "categories",
  "results",
  "audience",
  "format",
  "durationDays",
  "accessNote",
  "authorNote",
  "schedule",
  "theme",
  "cover",
  "status",
  "visibility",
  "entitlementProductCodes",
  "slug",
  "programSlug",
  "locale",
] as const;

export type CourseFieldName = (typeof COURSE_FIELDS)[number];

export type BlockDelta = {
  added: number;
  removed: number;
  edited: number;
};

export type LessonChange =
  | { kind: "added"; lessonId: string; title: string; moduleTitle: string }
  | { kind: "removed"; lessonId: string; title: string; moduleTitle: string }
  | {
      kind: "changed";
      lessonId: string;
      title: string;
      moduleTitle: string;
      /** Заголовок урока изменился. */
      renamed: boolean;
      /** Урок переехал в другой модуль или на другую позицию. */
      moved: boolean;
      blocks: BlockDelta;
      /**
       * Тронуты ли блоки `boundary_note` — «межі та застереження».
       *
       * Отдельный флаг, а не строка в общей куче: этот блок обязателен для
       * прохождения проверки, и правка именно его после одобрения — то
       * единственное изменение, ради обнаружения которого журнал и заводили.
       */
      boundaryTouched: boolean;
    };

export type ModuleChange =
  | { kind: "added"; moduleId: string; title: string }
  | { kind: "removed"; moduleId: string; title: string }
  | { kind: "changed"; moduleId: string; title: string; renamed: boolean; moved: boolean };

export type CourseDiff = {
  fields: CourseFieldName[];
  modules: ModuleChange[];
  lessons: LessonChange[];
  /** Хоть где-то тронуты «межі». Поднимается наверх, чтобы не искать по списку. */
  boundaryTouched: boolean;
  /** Ничего не изменилось. */
  empty: boolean;
};

/**
 * Глубокое сравнение значений.
 *
 * Порядок ключей объекта не значим (JSON из базы и JSON из редактора приходят
 * с разным порядком), порядок элементов массива — значим: переставленные шаги
 * протокола это другой протокол.
 */
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;

  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) return false;

  if (leftIsArray) {
    const a = left as unknown[];
    const b = right as unknown[];
    return a.length === b.length && a.every((item, index) => same(item, b[index]));
  }

  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!same(a[key], b[key])) return false;
  }
  return true;
}

/** Все блоки урока, включая вложенные в группы, плоским списком. */
function flattenBlocks(blocks: LessonBlock[]): LessonBlock[] {
  return blocks.flatMap((block) => (block.type === "group" ? [block, ...flattenBlocks(block.children)] : [block]));
}

function isBoundary(block: LessonBlock): boolean {
  return block.type === "boundary_note";
}

function diffBlocks(before: LessonBlock[], after: LessonBlock[]): { delta: BlockDelta; boundaryTouched: boolean } {
  const beforeById = new Map(flattenBlocks(before).map((block) => [block.id, block]));
  const afterById = new Map(flattenBlocks(after).map((block) => [block.id, block]));

  let added = 0;
  let removed = 0;
  let edited = 0;
  let boundaryTouched = false;

  for (const [id, block] of afterById) {
    const previous = beforeById.get(id);
    if (!previous) {
      added += 1;
      if (isBoundary(block)) boundaryTouched = true;
      continue;
    }
    if (!same(previous, block)) {
      edited += 1;
      if (isBoundary(block) || isBoundary(previous)) boundaryTouched = true;
    }
  }

  for (const [id, block] of beforeById) {
    if (afterById.has(id)) continue;
    removed += 1;
    if (isBoundary(block)) boundaryTouched = true;
  }

  return { delta: { added, removed, edited }, boundaryTouched };
}

type LessonSlot = { lesson: Lesson; unit: CourseModule };

function lessonsById(course: Course): Map<string, LessonSlot> {
  const slots = new Map<string, LessonSlot>();
  for (const unit of course.modules) {
    for (const lesson of unit.lessons) slots.set(lesson.id, { lesson, unit });
  }
  return slots;
}

/**
 * Разница между двумя версиями одного курса.
 *
 * `before` — та версия, от которой считаем (одобренный релиз, предыдущая
 * ревизия), `after` — та, что сравниваем с ней.
 */
export function diffCourses(before: Course, after: Course): CourseDiff {
  const fields = COURSE_FIELDS.filter(
    (field) =>
      !same(
        (before as unknown as Record<string, unknown>)[field],
        (after as unknown as Record<string, unknown>)[field],
      ),
  );

  const beforeModules = new Map(before.modules.map((unit) => [unit.id, unit]));
  const afterModules = new Map(after.modules.map((unit) => [unit.id, unit]));

  const modules: ModuleChange[] = [];
  for (const [id, unit] of afterModules) {
    const previous = beforeModules.get(id);
    if (!previous) {
      modules.push({ kind: "added", moduleId: id, title: unit.title });
      continue;
    }
    const renamed = previous.title !== unit.title;
    const moved = previous.order !== unit.order;
    const otherwise = !same(
      { ...previous, lessons: undefined, title: undefined, order: undefined },
      { ...unit, lessons: undefined, title: undefined, order: undefined },
    );
    if (renamed || moved || otherwise) {
      modules.push({ kind: "changed", moduleId: id, title: unit.title, renamed, moved });
    }
  }
  for (const [id, unit] of beforeModules) {
    if (!afterModules.has(id)) modules.push({ kind: "removed", moduleId: id, title: unit.title });
  }

  const beforeLessons = lessonsById(before);
  const afterLessons = lessonsById(after);

  const lessons: LessonChange[] = [];
  let boundaryTouched = false;

  for (const [id, slot] of afterLessons) {
    const previous = beforeLessons.get(id);
    if (!previous) {
      lessons.push({ kind: "added", lessonId: id, title: slot.lesson.title, moduleTitle: slot.unit.title });
      // Новый урок целиком — это и новые «межі» в нём, если они там есть.
      if (flattenBlocks(slot.lesson.blocks).some(isBoundary)) boundaryTouched = true;
      continue;
    }

    const { delta, boundaryTouched: blockBoundary } = diffBlocks(previous.lesson.blocks, slot.lesson.blocks);
    const renamed = previous.lesson.title !== slot.lesson.title;
    const moved = previous.unit.id !== slot.unit.id || previous.lesson.order !== slot.lesson.order;
    const metaChanged = !same(
      { ...previous.lesson, blocks: undefined, title: undefined, order: undefined },
      { ...slot.lesson, blocks: undefined, title: undefined, order: undefined },
    );

    if (delta.added || delta.removed || delta.edited || renamed || moved || metaChanged) {
      lessons.push({
        kind: "changed",
        lessonId: id,
        title: slot.lesson.title,
        moduleTitle: slot.unit.title,
        renamed,
        moved,
        blocks: delta,
        boundaryTouched: blockBoundary,
      });
    }
    if (blockBoundary) boundaryTouched = true;
  }

  for (const [id, slot] of beforeLessons) {
    if (afterLessons.has(id)) continue;
    lessons.push({ kind: "removed", lessonId: id, title: slot.lesson.title, moduleTitle: slot.unit.title });
    // Удалённый урок мог быть тем, где «межі» и стояли.
    if (flattenBlocks(slot.lesson.blocks).some(isBoundary)) boundaryTouched = true;
  }

  return {
    fields,
    modules,
    lessons,
    boundaryTouched,
    empty: fields.length === 0 && modules.length === 0 && lessons.length === 0,
  };
}
