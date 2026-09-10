/**
 * Rows or grid for the course shelf, remembered and announced, plus the reflow the shelf runs when an entry leaves.
 *
 * Split out of BuilderCourseList.tsx (1,115 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type CourseView = "rows" | "grid";

export const VIEW_KEY = "cw.builder.courseView";

/* `storage` only reaches OTHER tabs, so the writing tab announces itself. */
export const VIEW_EVENT = "cw:builder-view";

export function subscribeToView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEW_EVENT, onChange);
  };
}

/**
 * The chosen view, read from storage rather than mirrored into state.
 *
 * Not `useState` + an effect: localStorage does not exist on the server, so the
 * value cannot be the initial state, and copying it in after mount is a second
 * render of a tree that was already correct — the pattern React now flags. This
 * reads the store directly and renders "rows" on the server, which is what the
 * author sees for the one frame before hydration either way.
 */
export function readView(): CourseView {
  const stored = window.localStorage.getItem(VIEW_KEY);
  return stored === "grid" ? "grid" : "rows";
}

/**
 * The builder's front door.
 *
 * TWO VIEWS OF ONE SHELF, and they answer different questions. Rows are for
 * WORK: one line per course, the blocker count and the status where the eye
 * already is, and the reorder controls in reach — an author with eleven courses
 * scans a list, not a wall of pictures. The grid is for RECOGNITION: covers,
 * titles, the course as an object. Which one is right depends on the day, so
 * the choice is the author's and it is remembered.
 *
 * The preference lives in `localStorage` rather than in the database. It is a
 * property of this screen on this device — the same author on a phone wants
 * rows and on a desktop wants the grid — and a column would have made it one
 * global opinion that follows them onto the wrong device.
 */
/**
 * How long a course takes to leave, and the one place that number lives.
 *
 * The CSS transition on `[data-removing]` runs for `--builder-motion-page`;
 * this is the same duration in the one unit JavaScript can wait in. They have
 * to agree, because the delete request is raced against it: whichever finishes
 * last decides when the shelf closes up.
 */
export const REMOVE_MS = 240;

/**
 * FLIP, so the gap left by a deleted course closes instead of teleporting.
 *
 * Grid and flex reflow is not animatable — there is no transition between two
 * layouts, only the second one. FLIP gets around that without owning the
 * layout: read where every item was on the previous commit, read where it is
 * now, and if it moved, play it from the old position back to the new one with
 * a transform. The layout is already correct the entire time; the transform is
 * a lie told for 260ms about where the browser has finished putting things.
 *
 * `useLayoutEffect`, not `useEffect`: the measurement has to happen before the
 * browser paints the new positions, or the reader sees the jump this exists to
 * hide and then sees it animate a second time.
 *
 * Items are matched by `data-flip-key` rather than by index, so a deletion in
 * the middle moves the cards that actually moved instead of shifting every key
 * by one. Anything mid-leave is skipped — it is running its own animation in
 * place and has not moved.
 *
 * `resetKey` is the one thing this must NOT animate. Switching grid↔rows moves
 * every card by hundreds of pixels, and playing that back is not a shelf
 * closing a gap — it is one layout flying into another, which reads as chaos
 * and says nothing. When the key changes the run measures and records without
 * animating, so the new view starts from a clean baseline.
 */
export function useShelfReflow(resetKey: string, deps: unknown[]) {
  const container = useRef<HTMLDivElement & HTMLUListElement>(null);
  const lastRects = useRef(new Map<string, DOMRect>());
  const lastResetKey = useRef(resetKey);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rebased = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-flip-key]"));
    const nextRects = new Map<string, DOMRect>();

    for (const item of items) {
      const key = item.dataset.flipKey;
      if (!key) continue;
      const rect = item.getBoundingClientRect();
      nextRects.set(key, rect);

      if (reduced || rebased || item.hasAttribute("data-removing")) continue;

      const previous = lastRects.current.get(key);
      if (!previous) continue;

      const dx = previous.left - rect.left;
      const dy = previous.top - rect.top;
      // Sub-pixel drift is not movement; animating it would fire an animation
      // on every card on every reload.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 260, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      );
    }

    lastRects.current = nextRects;
    // The caller passes the list identity and the removal in flight; this hook
    // has no opinion about what makes the shelf change shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, ...deps]);

  return container;
}
