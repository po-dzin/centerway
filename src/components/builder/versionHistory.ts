import type { Course } from "@/lms-core";
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
