/**
 * Which way the course structure is shown — rows or cards — remembered across visits and announced across tabs.
 *
 * Split out of BuilderCourseView.tsx (1,458 lines) on 2026-09-11; nothing inside any declaration changed.
 */

export type StructureView = "rows" | "cards";

/**
 * The four screens of a course, in the order the work happens.
 *
 * `course` is the COVER — the catalogue card and everything on it. `offer` is
 * the OFFER PAGE — what a buyer reads after they clicked. They were one tab
 * called «Огляд» until 2026-08-28, and one tab was the reason the offer half
 * looked optional: it lived below the fold of the card half.
 *
 * The key stays `course` rather than becoming `cover`, and the hash stays
 * `#course-overview`, because blocker arrows already point course-level
 * blockers there (`blockerTargets.ts`) and links to it are already in the
 * wild. Renaming the identifier would have renamed a URL to fix a label.
 *
 * `author` joined 2026-08-28: who this course's byline is, and the one line
 * (`authorNote`) that changes about them from course to course. It used to be
 * a field buried at the bottom of `offer`'s settings; a byline that a course
 * cannot exist without printing correctly earned a screen of its own, not a
 * row at the end of someone else's form.
 */
export const STRUCTURE_VIEW_KEY = "cw.builder.structureView";

export const STRUCTURE_VIEW_EVENT = "cw:builder-structure-view";

// Two module cards need enough measure for a title, grip and overflow menu.
// Phones and compact tablets stay in the faster, reorderable row view.
export const STRUCTURE_WIDE = "(min-width: 901px)";

export function subscribeToStructureView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STRUCTURE_VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STRUCTURE_VIEW_EVENT, onChange);
  };
}

export function readStructureView(): StructureView {
  return window.localStorage.getItem(STRUCTURE_VIEW_KEY) === "cards" ? "cards" : "rows";
}

export function subscribeToStructureWidth(onChange: () => void) {
  const query = window.matchMedia(STRUCTURE_WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
