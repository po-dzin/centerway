/**
 * The drag-and-drop MIME types the lesson editor and its block editor share.
 *
 * Split out of BuilderLessonEditor.tsx (1,871 lines, seven components) on 2026-09-10.
 */

import type { DragEvent } from "react";
import styles from "./Builder.module.css";

export const BUILDER_BLOCK_MIME = "application/x-centerway-block";

/**
 * What the pointer carries out of the palette.
 *
 * The browser's default drag image for a palette row is a snapshot of that
 * row — a wide strip of the tool panel, dragged across a manuscript, saying
 * nothing about what is being placed. A block already in the document drags
 * its own snapshot and therefore looks like the thing it is; this gives a
 * block coming FROM the palette the same courtesy: a small chip with its name,
 * under the cursor.
 *
 * Detached and removed on the next frame, because `setDragImage` only needs the
 * element to be rendered at the moment it is called, and one left in the
 * document would sit at the bottom of the page for the rest of the session.
 */
export function carryChip(event: DragEvent<HTMLElement>, label: string) {
  if (typeof document === "undefined") return;
  const chip = document.createElement("div");
  chip.className = styles.dragChip ?? "";
  chip.textContent = label;
  document.body.append(chip);
  event.dataTransfer.setDragImage(chip, 12, 16);
  requestAnimationFrame(() => chip.remove());
}

/** A block already in the lesson, on its way to another gap in it. */
export const BLOCK_MOVE_MIME = "application/x-centerway-block-move";
