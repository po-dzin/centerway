import { flattenLessons, type Course, type ReadinessBlocker } from "@/lms-core";

/**
 * The same blockers the release panel lists, read the other way round: not
 * «here is a hole, go there» but «this place has a hole in it».
 *
 * The panel is where an author learns that something stops the publish; these
 * flags are what they meet on arrival, so the arrow ends on a marked place and
 * the outline shows where else to look. Resolved the way `blockerTarget`
 * resolves them — whole module/lesson slug pairs, never a positional split —
 * and the block INDEX becomes the block's id, because the editor addresses
 * blocks by id and an index names a different block once one is inserted above.
 */
export type BlockerFlags = {
  /** lesson id → how many holes it carries (its blocks and the lesson itself). */
  lessons: Map<string, number>;
  /** module id → how many holes sit in its lessons. */
  modules: Map<string, number>;
  /** ids of the blocks that carry a hole. */
  blocks: Set<string>;
  /** course-level codes, for the fields that answer them. */
  courseCodes: Set<string>;
};

const BLOCK_SUFFIX = /\.blocks\[(\d+)]$/;

export function blockerFlags(course: Course, blockers: ReadinessBlocker[]): BlockerFlags {
  const flags: BlockerFlags = { lessons: new Map(), modules: new Map(), blocks: new Set(), courseCodes: new Set() };
  // Counts are PLACES, not violations: one block can break two rules at once.
  const lessonPaths = new Map<string, Set<string>>();
  const modulePaths = new Map<string, Set<string>>();
  const places = flattenLessons(course);
  for (const blocker of blockers) {
    const match = BLOCK_SUFFIX.exec(blocker.path);
    const lessonPath = match ? blocker.path.slice(0, -match[0].length) : blocker.path;
    if (lessonPath === course.slug) {
      flags.courseCodes.add(blocker.code);
      continue;
    }
    const place = places.find(({ module, lesson }) => lessonPath === `${course.slug}.${module.slug}.${lesson.slug}`);
    if (!place) continue;
    lessonPaths.set(place.lesson.id, (lessonPaths.get(place.lesson.id) ?? new Set()).add(blocker.path));
    modulePaths.set(place.module.id, (modulePaths.get(place.module.id) ?? new Set()).add(blocker.path));
    const block = match ? place.lesson.blocks[Number(match[1])] : undefined;
    if (block) flags.blocks.add(block.id);
  }
  for (const [id, paths] of lessonPaths) flags.lessons.set(id, paths.size);
  for (const [id, paths] of modulePaths) flags.modules.set(id, paths.size);
  return flags;
}
