import type { CourseModule } from "@/lms-core";
import { landingIndex, type DragRef, type DropEdge } from "./useRowDrag";

/**
 * Moving and removing modules and lessons — the arithmetic, once.
 *
 * The course workspace and the lesson editor's outline are two views of the
 * SAME list, and both let an author reorder and delete in it. Two copies of
 * these rules would be two places for the off-by-one in {@link landingIndex} to
 * be got wrong, and two places to remember the refusals below — which are not
 * style choices but the shape `validateCourse` insists on. Kept here they are
 * one behaviour that happens to have two surfaces.
 *
 * A refusal returns `null` rather than the unchanged list, so a caller can tell
 * «this move does nothing» from «this move is not allowed» and say why. The two
 * are different sentences to an author who just tried it.
 */

/** Said to the author who tried it, not swallowed: the module is the unit here. */
export const LAST_LESSON_REFUSAL = "Останній урок модуля не видаляється — видаліть модуль цілком.";

const clone = (modules: CourseModule[]): CourseModule[] =>
  modules.map((entry) => ({ ...entry, lessons: [...entry.lessons] }));

export function moveModuleTo(modules: CourseModule[], from: DragRef, to: DragRef, edge: DropEdge): CourseModule[] {
  const next = clone(modules);
  const insert = landingIndex(from.index, to.index, edge, true);
  const [moved] = next.splice(from.index, 1);
  next.splice(insert, 0, moved);
  return next;
}

/**
 * Lessons move ACROSS modules, the same way the arrows carry one over a module
 * edge — the reason to pick a lesson up is usually that it belongs to another
 * week.
 *
 * The one refusal is the arrows' own: a module cannot be emptied by a move,
 * because `validateCourse` requires at least one lesson in each and the author
 * would meet that as a save error long after the gesture.
 */
export function moveLessonTo(
  modules: CourseModule[],
  from: DragRef,
  to: DragRef,
  edge: DropEdge
): CourseModule[] {
  const next = clone(modules);
  const source = next[from.group];
  const target = next[to.group];
  if (!source || !target) return next;
  if (source !== target && source.lessons.length === 1) return next;

  const insert = landingIndex(from.index, to.index, edge, source === target);
  const [moved] = source.lessons.splice(from.index, 1);
  target.lessons.splice(insert, 0, moved);
  return next;
}

/**
 * The keyboard and touch path for the same move: the grip is a pointer gesture
 * and is not rendered on a coarse pointer, so every reorder a drag can do has
 * to be reachable from the row's menu as well.
 */
export function stepModule(modules: CourseModule[], index: number, delta: number): CourseModule[] | null {
  const target = index + delta;
  if (target < 0 || target >= modules.length) return null;
  const next = clone(modules);
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Pressing «down» on the last lesson of a module means «put it in the next
 * one»: that is where the author is looking, and stopping at the boundary would
 * make regrouping impossible without deleting and retyping.
 */
export function stepLesson(
  modules: CourseModule[],
  moduleIndex: number,
  lessonIndex: number,
  delta: number
): CourseModule[] | null {
  const next = clone(modules);
  const from = next[moduleIndex];
  if (!from) return null;
  const target = lessonIndex + delta;

  if (target >= 0 && target < from.lessons.length) {
    const [moved] = from.lessons.splice(lessonIndex, 1);
    from.lessons.splice(target, 0, moved);
    return next;
  }

  const neighbourIndex = moduleIndex + delta;
  if (neighbourIndex < 0 || neighbourIndex >= next.length) return null;
  if (from.lessons.length === 1) return null;

  const [moved] = from.lessons.splice(lessonIndex, 1);
  const neighbour = next[neighbourIndex];
  neighbour.lessons.splice(delta > 0 ? 0 : neighbour.lessons.length, 0, moved);
  return next;
}

/** The last module cannot go: `validateCourse` requires one. */
export function removeModule(modules: CourseModule[], index: number): CourseModule[] | null {
  if (modules.length <= 1) return null;
  return modules.filter((_, position) => position !== index);
}

/** Nor the last lesson of a module — that is a request to delete the module. */
export function removeLesson(
  modules: CourseModule[],
  moduleIndex: number,
  lessonIndex: number
): CourseModule[] | null {
  const holder = modules[moduleIndex];
  if (!holder || holder.lessons.length <= 1) return null;
  return modules.map((entry, index) =>
    index === moduleIndex
      ? { ...entry, lessons: entry.lessons.filter((_, position) => position !== lessonIndex) }
      : entry
  );
}
