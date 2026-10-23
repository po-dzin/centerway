import { flattenLessons, type Course, type ReadinessBlocker } from "@/lms-core";
import { blockerTarget, blockerTrail } from "./blockerTargets";

/**
 * The places that still stand between a course and its publish, as a walk.
 *
 * `blockerFlags` answers «does this place have a hole»; this answers «which is
 * the next one». Same unit as the counts everywhere else: a PLACE, deduped by
 * path, so a block that breaks two rules is one stop. Order is the course's own
 * — course-level fields first, then each lesson in stored order with the lesson
 * itself before its blocks — so → always moves forward through what the author
 * would read, and never jumps about by the order the checks happened to run.
 */
export type BlockerPlace = {
  /** The blocker's path: unique per place. */
  key: string;
  code: string;
  href: string;
  /** Course-level places have no lesson. */
  lessonId: string | null;
  lessonSlug: string | null;
  blockId: string | null;
  /** Position in the walk; see `placeOrder`. */
  order: number;
  trail: string;
};

const BLOCK_SUFFIX = /\.blocks\[(\d+)]$/;
const LESSON_SPAN = 1000;

/** Where a lesson (and optionally one of its blocks) sits in the walk. */
export function placeOrder(lessonIndex: number, blockIndex: number | null): number {
  return lessonIndex * LESSON_SPAN + (blockIndex === null ? 0 : blockIndex + 1);
}

export function blockerPlaces(course: Course, blockers: ReadonlyArray<ReadinessBlocker>): BlockerPlace[] {
  const lessons = flattenLessons(course);
  const seen = new Set<string>();
  const places: BlockerPlace[] = [];
  for (const blocker of blockers) {
    if (seen.has(blocker.path)) continue;
    const target = blockerTarget(course, blocker);
    // A stale report about a lesson that is gone is not a place to walk to.
    if (!target) continue;
    seen.add(blocker.path);
    const match = BLOCK_SUFFIX.exec(blocker.path);
    const lessonPath = match ? blocker.path.slice(0, -match[0].length) : blocker.path;
    const at = lessons.findIndex(({ module, lesson }) => lessonPath === `${course.slug}.${module.slug}.${lesson.slug}`);
    const entry = at >= 0 ? lessons[at] : undefined;
    const block = entry && match ? entry.lesson.blocks[Number(match[1])] : undefined;
    places.push({
      key: blocker.path,
      code: blocker.code,
      href: target.href,
      lessonId: entry?.lesson.id ?? null,
      lessonSlug: entry?.lesson.slug ?? null,
      blockId: block?.id ?? null,
      order: entry ? placeOrder(at, block && match ? Number(match[1]) : null) : -1,
      trail: blockerTrail(course, blocker).slice(1).join(", ") || blockerTrail(course, blocker).join(", "),
    });
  }
  return places.sort((a, b) => a.order - b.order);
}

/**
 * The stop after (or before) `from`, wrapping at the ends.
 *
 * `from` is where the author is now, in `placeOrder` terms, or null when they
 * are nowhere in particular — then → is the first stop and ← the last.
 */
export function stepPlace(
  places: ReadonlyArray<BlockerPlace>,
  from: number | null,
  direction: 1 | -1,
): { place: BlockerPlace; wrapped: boolean } | null {
  if (places.length === 0) return null;
  if (from === null) {
    const place = direction > 0 ? places[0] : places[places.length - 1];
    return place ? { place, wrapped: false } : null;
  }
  const ahead =
    direction > 0 ? places.find((place) => place.order > from) : [...places].reverse().find((p) => p.order < from);
  if (ahead) return { place: ahead, wrapped: false };
  const place = direction > 0 ? places[0] : places[places.length - 1];
  return place ? { place, wrapped: true } : null;
}
