"use client";

/**
 * A panel pinned to the button that opened it: the reaction set and the share
 * menu. Fixed to the viewport rather than to the card, because on the home
 * page the card stands in a rail that scrolls sideways and would clip any
 * panel positioned inside it. Below the button when it fits, above it when it
 * does not; never past the screen's edge. On a phone (≤ 40rem) the stylesheet
 * turns the panel into a sheet at the bottom and this placement stands aside.
 *
 * The position is written straight onto the panel before paint (a layout
 * effect on the DOM, not React state), so it never flashes at 0,0.
 *
 * It closes on a press outside, on Escape (focus returns to the button), and
 * when the page scrolls underneath it — a fixed panel left behind by its
 * button points at nothing.
 */

import { useEffect, useLayoutEffect, type RefObject } from "react";

const GAP = 8;
/** Where the stylesheet makes the panel a bottom sheet (Feed.module.css). */
const SHEET = "(max-width: 40rem)";

export function useFloating(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  close: () => void,
  align: "start" | "end" = "start",
): void {
  useLayoutEffect(() => {
    const node = panel.current;
    if (!open || !anchor.current || !node) return;
    if (window.matchMedia(SHEET).matches) {
      node.style.removeProperty("top");
      node.style.removeProperty("left");
      return;
    }
    const box = anchor.current.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const left =
      align === "end"
        ? Math.max(GAP, Math.min(box.right - width, window.innerWidth - width - GAP))
        : Math.max(GAP, Math.min(box.left, window.innerWidth - width - GAP));
    const below = box.bottom + GAP;
    const top =
      below + height <= window.innerHeight - GAP ? below : Math.max(GAP, Math.min(box.top - height - GAP, below));
    node.style.setProperty("top", `${top}px`);
    node.style.setProperty("left", `${left}px`);
  }, [open, anchor, panel, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      anchor.current?.focus();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, anchor, panel, close]);
}
