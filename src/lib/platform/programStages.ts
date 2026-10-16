/**
 * The stages a program is walked in — the line in the «Як побудовано» panel
 * of a program page (G, 2026-10-15).
 *
 * Derived from the course's own modules, so an author writes nothing new: a
 * stage is a module that is a step of the protocol (not reference material,
 * not a linked program, not empty). A daily course says which days each stage
 * covers; any other course says how many lessons it holds.
 *
 * Fewer than two stages is not a route — one module is the whole course, and
 * the panel keeps its plain list.
 */
import { inlineToPlainText } from "@/lms-core/inline";
import { isLinkedModule, type Course } from "@/lms-core/course";
import { plural } from "@/lib/plural";

export type ProgramStage = {
  id: string;
  /** «День 1», «Дні 2–7», or «4 уроки». */
  kicker: string;
  title: string;
  summary: string | null;
};

export function programStages(course: Course): ProgramStage[] | null {
  const modules = course.modules.filter(
    (module) => !module.reference && !isLinkedModule(module) && module.lessons.length > 0,
  );
  if (modules.length < 2) return null;

  return modules.map((module) => {
    const summary = module.summary ? inlineToPlainText(module.summary).trim() : "";
    return {
      id: module.id,
      kicker: stageKicker(course, module.lessons),
      title: module.title,
      summary: summary.length > 0 ? summary : null,
    };
  });
}

function stageKicker(course: Course, lessons: Course["modules"][number]["lessons"]): string {
  const days = lessons.map((lesson) => lesson.dayIndex).filter((day): day is number => typeof day === "number");
  if (course.schedule.mode === "daily" && days.length === lessons.length) {
    const first = Math.min(...days);
    const last = Math.max(...days);
    return first === last ? `День ${first}` : `Дні ${first}–${last}`;
  }
  return `${lessons.length} ${plural(lessons.length, "урок", "уроки", "уроків")}`;
}
