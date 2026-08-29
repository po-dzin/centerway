import { flattenLessons, type Course, type ReadinessBlocker } from "@/lms-core";

/**
 * Where a blocker actually lives, as a place the author can be sent.
 *
 * `courseReadiness` reports an ADDRESS — `way21.week-1.day-2.blocks[3]` — and
 * the release panel has been printing it verbatim since it existed. That is the
 * right thing to print: it says exactly where the hole is and it is the same
 * string the CLI and the agent report. But it left the last step to the author:
 * read the address, work out that the middle part is a module, go to the
 * outline, find the lesson, count the blocks. Sixty holes in a fresh course
 * makes that sixty manual lookups.
 *
 * The path is resolved against the course rather than parsed positionally: a
 * slug may in principle carry a dot, and matching whole module/lesson pairs
 * cannot be fooled by one. The block INDEX is turned into the block's own id
 * here, because the editor addresses blocks by id — an index would name a
 * different block the moment one is inserted above it.
 */
export type BlockerTarget = {
  href: string;
  /** What the author is being sent to, for the control's accessible name. */
  label: string;
};

const BLOCK_SUFFIX = /\.blocks\[(\d+)]$/;

export function blockerTarget(course: Course, blocker: ReadinessBlocker): BlockerTarget | null {
  const match = BLOCK_SUFFIX.exec(blocker.path);
  const lessonPath = match ? blocker.path.slice(0, -match[0].length) : blocker.path;
  const build = `/build/${encodeURIComponent(course.slug)}`;

  // A course-level blocker — a marker in the title, a missing boundary note.
  // It has no lesson to open, so it points at the course's own first screen.
  if (lessonPath === course.slug) return { href: `${build}#course-overview`, label: "Обкладинка курсу" };

  for (const { module, lesson } of flattenLessons(course)) {
    if (lessonPath !== `${course.slug}.${module.slug}.${lesson.slug}`) continue;
    const href = `${build}/${encodeURIComponent(lesson.slug)}`;
    if (!match) return { href, label: `Урок «${lesson.title}»` };
    const block = lesson.blocks[Number(match[1])];
    if (!block) return { href, label: `Урок «${lesson.title}»` };
    return { href: `${href}#block-${block.id}`, label: `Блок в уроці «${lesson.title}»` };
  }

  return null;
}
