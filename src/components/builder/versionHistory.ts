import type { Course, CourseDiff } from "@/lms-core";
import type { CourseRevisionKind } from "@/lib/lms/revisions";

export const REVISION_KIND_LABELS: Record<CourseRevisionKind, string> = {
  manual: "Ручна версія",
  review_submitted: "Надіслано на перевірку",
  published: "Опубліковано",
  restored: "Відновлено",
  autosave_checkpoint: "Автоматична контрольна точка",
};

export type CourseShape = {
  modules: number;
  lessons: number;
  blocks: number;
};

export function courseShape(course: Course): CourseShape {
  return course.modules.reduce<CourseShape>(
    (shape, module) => ({
      modules: shape.modules + 1,
      lessons: shape.lessons + module.lessons.length,
      blocks: shape.blocks + module.lessons.reduce((total, lesson) => total + lesson.blocks.length, 0),
    }),
    { modules: 0, lessons: 0, blocks: 0 },
  );
}

/**
 * Разница — одной строкой, человеческим языком.
 *
 * Числами, а не перечислением: «5 уроків змінено» читается, а список из пяти
 * заголовков в боковой панели — уже нет. Подробности автор видит, открыв
 * версию; здесь нужен ответ на «стоит ли открывать».
 */
export function summarizeDiff(diff: CourseDiff): string {
  if (diff.empty) return "Нічого не змінилося";

  const parts: string[] = [];
  const lessonsAdded = diff.lessons.filter((entry) => entry.kind === "added").length;
  const lessonsRemoved = diff.lessons.filter((entry) => entry.kind === "removed").length;
  const lessonsChanged = diff.lessons.filter((entry) => entry.kind === "changed").length;

  if (diff.fields.length > 0) parts.push(`${diff.fields.length} полів курсу`);
  if (diff.modules.length > 0) parts.push(`${diff.modules.length} модулів`);
  if (lessonsAdded > 0) parts.push(`${lessonsAdded} уроків додано`);
  if (lessonsRemoved > 0) parts.push(`${lessonsRemoved} уроків вилучено`);
  if (lessonsChanged > 0) parts.push(`${lessonsChanged} уроків змінено`);

  return parts.join(" · ");
}

/**
 * Предупреждение, которое не должно теряться в общем счёте.
 *
 * «Межі та застереження» — обов'язковий блок, і правка саме його після
 * проходження перевірки це те, заради виявлення чого журнал і заводили.
 */
export const BOUNDARY_WARNING = "Зачеплено блок «межі та застереження»";
