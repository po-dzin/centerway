import { flattenLessons, type Course, type ReadinessBlocker } from "@/lms-core";
import { COURSE_WORKSPACE_HASH } from "./courseWorkspace";

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

/** The course-level blockers whose field lives on «Сторінка», not «Обкладинка». */
const STOREFRONT_BLOCKERS = new Set([
  "lms_ready_missing_audience",
  "lms_ready_missing_results",
  "lms_ready_missing_format",
  "lms_ready_missing_access_note",
]);

export function blockerTarget(course: Course, blocker: ReadinessBlocker): BlockerTarget | null {
  const match = BLOCK_SUFFIX.exec(blocker.path);
  const lessonPath = match ? blocker.path.slice(0, -match[0].length) : blocker.path;
  const build = `/build/${encodeURIComponent(course.slug)}`;

  /* A course-level blocker — a marker in the title, a missing boundary note.
     It has no lesson to open, so it points at a TAB of the course itself.

     Which tab is not one answer any more (2026-09-08). The cover's five holes
     are filled on «Обкладинка» and the storefront's four on «Сторінка», and
     sending both to the first screen meant an author who pressed the arrow for
     «не сказано, що входить» landed on the picture and the title and had to
     find the right tab themselves — the one thing the arrow exists to spare
     them. The hashes come from `courseWorkspace.ts`, so a tab cannot be
     renamed out from under this list. */
  if (lessonPath === course.slug) {
    return STOREFRONT_BLOCKERS.has(blocker.code)
      ? { href: `${build}${COURSE_WORKSPACE_HASH.offer}`, label: "Сторінка програми" }
      : { href: `${build}${COURSE_WORKSPACE_HASH.course}`, label: "Обкладинка курсу" };
  }

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
