"use client";

import { useCallback, useState, type DragEvent, type PointerEvent } from "react";

/**
 * Dragging a row into another place in its list.
 *
 * WHY THIS EXISTS ALONGSIDE THE ARROWS, NOT INSTEAD OF THEM. The arrows were
 * chosen because dragging on a phone needs a long press, a scroll lock and an
 * autoscroll, and is unreachable from a keyboard without a second control. All
 * of that is still true, and the arrows stay. What was wrong was the conclusion
 * "therefore nowhere": on a big screen with a pointer, dragging is the natural
 * way to move a row, and the builder is a tool people use on a big screen.
 *
 * WHY NATIVE HTML5 DRAG. It is the browser's own mechanism, so autoscrolling
 * past the edge of the viewport, the drag image, the cursor and the escape key
 * are all already handled — a pointer-event implementation would have to write
 * every one of them, and would write them worse. The cost is that the drop
 * target has to be read from `dragover` geometry rather than from a layout
 * animation, which is what {@link edgeOf} does.
 *
 * WHY A HANDLE ARMS IT. A lesson row is a link, and a draggable link drags its
 * URL. Rows are `draggable` only while the pointer went down on their grip, so
 * a plain press still selects text and still follows the link. It is also what
 * keeps this off touch: the grip is hidden under `(pointer: coarse)`, so a
 * finger has nothing to arm and the arrows remain the only way to reorder —
 * exactly the split that was decided.
 */

export type DragRef = {
  /** Which list this row belongs to. A row only ever drops into its own kind. */
  list: string;
  /** Which container within that kind — the module a lesson sits in, say. */
  group: number;
  index: number;
};

export type DropEdge = "before" | "after";

export type RowDrag = {
  /** Spread onto the grip. Arms the row it belongs to and nothing else. */
  handleProps: (ref: DragRef) => {
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: () => void;
    draggable: false;
  };
  /** Spread onto the row itself. */
  rowProps: (ref: DragRef) => {
    draggable: boolean;
    onDragStart: (event: DragEvent) => void;
    onDragEnd: () => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    "data-dragging"?: "true";
    "data-drop"?: DropEdge;
  };
};

const key = (ref: DragRef) => `${ref.list}:${ref.group}:${ref.index}`;

const same = (a: DragRef, b: DragRef) => key(a) === key(b);

/** Which half of the row the pointer is in — above the middle means "put it before". */
function edgeOf(event: DragEvent): DropEdge {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * @param onMove Called with the row that was picked up and the place it was
 *   dropped. `index`/`edge` describe a position in the list AS IT STANDS, so
 *   the caller does the splice-out-then-splice-in itself — see {@link landingIndex}.
 * @param crossGroup Whether a row may leave its container. True for lessons,
 *   which move between modules exactly as the arrows already move them at a
 *   module edge; false for everything else.
 * @param mime A payload type carried alongside the plain-text key. `dragover`
 *   may read the TYPES of a drag but never its data, so a surface that has to
 *   recognise this drag while it is still moving — the lesson document, which
 *   nominates the gap a block will land in — has nothing else to recognise it
 *   by.
 * @param dropTargets Whether each row also accepts drops. False where the drop
 *   is owned by something larger: block reordering lands in the GAPS between
 *   blocks, and a row that also handled the drop would answer first and answer
 *   differently.
 * @param portraitClass A class put on the row for exactly the frame in which
 *   the browser snapshots it, and taken off again on the next one.
 *
 *   WHAT IT IS FOR. The default drag image is a picture of the whole draggable
 *   element — and a block carries things in its margin that are not the block:
 *   the selection rule and the handle rail. Lifting a paragraph therefore
 *   lifted a stripe and two controls with it, which is the editor's furniture
 *   floating over the editor. The class hides that furniture for the snapshot
 *   only, so what the pointer carries is the block's own content. The row is
 *   still grabbable anywhere it was before — this changes the portrait, not the
 *   handle.
 */
export function useRowDrag(
  onMove: (from: DragRef, to: DragRef, edge: DropEdge) => void,
  {
    crossGroup = false,
    mime,
    dropTargets = true,
    portraitClass,
  }: { crossGroup?: boolean; mime?: string; dropTargets?: boolean; portraitClass?: string } = {}
): RowDrag {
  const [dragging, setDragging] = useState<DragRef | null>(null);
  const [over, setOver] = useState<{ ref: DragRef; edge: DropEdge } | null>(null);
  /**
   * The row whose grip is currently held down.
   *
   * State, not a ref, and that is the whole trick: `draggable` is an attribute
   * the browser reads when the gesture begins, so the row has to have been
   * re-rendered as draggable BEFORE `dragstart`. Pointerdown and the movement
   * that starts a drag are separate events with a render between them, which is
   * exactly the gap this uses. A ref would never repaint and nothing would drag.
   */
  const [armed, setArmed] = useState<string | null>(null);

  const accepts = useCallback(
    (ref: DragRef) =>
      dragging !== null &&
      dragging.list === ref.list &&
      (crossGroup || dragging.group === ref.group),
    [crossGroup, dragging]
  );

  const handleProps = useCallback(
    (ref: DragRef) => ({
      onPointerDown: (event: PointerEvent) => {
        // Only a real pointer arms a drag. A pen counts; a finger does not, and
        // on a finger the grip is not rendered anyway.
        if (event.pointerType === "touch") return;
        setArmed(key(ref));
      },
      onPointerUp: () => {
        // A press that never became a drag. Native drag suppresses pointer
        // events, so this does not fire mid-carry — `dragend` clears that case.
        setArmed(null);
      },
      // The grip is inside the row, and a draggable child would start its own
      // drag with itself as the image.
      draggable: false as const,
    }),
    []
  );

  const rowProps = useCallback(
    (ref: DragRef) => {
      const isDragging = dragging !== null && same(dragging, ref);
      const isOver = over !== null && same(over.ref, ref) && accepts(ref) && !isDragging;

      return {
        draggable: armed === key(ref) || isDragging,
        onDragStart: (event: DragEvent) => {
          if (armed !== key(ref)) {
            // A NESTED draggable row — a lesson inside its draggable module, a
            // rich-text node inside its draggable block — starts its own drag,
            // and the browser bubbles that dragstart up to every ancestor's
            // handler, including this one, which is never armed for a gesture
            // that began on a child. `target !== currentTarget` is how a
            // bubbled event is told apart from one that began here: only a
            // drag that genuinely started on THIS row without being armed —
            // a link, selected text — gets cancelled.
            if (event.target === event.currentTarget) {
              event.preventDefault();
            }
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          // Firefox refuses to start a drag with an empty payload.
          event.dataTransfer.setData("text/plain", key(ref));
          if (mime) event.dataTransfer.setData(mime, key(ref));
          if (portraitClass) {
            // `setDragImage` reads the element as it is painted at THIS moment,
            // so the class only has to survive the call. Removing it on the next
            // frame keeps the row on screen unchanged while it is being dragged.
            const node = event.currentTarget as HTMLElement;
            const rect = node.getBoundingClientRect();
            node.classList.add(portraitClass);
            event.dataTransfer.setDragImage(node, event.clientX - rect.left, event.clientY - rect.top);
            requestAnimationFrame(() => node.classList.remove(portraitClass));
          }
          setDragging(ref);
        },
        onDragEnd: () => {
          setArmed(null);
          setDragging(null);
          setOver(null);
        },
        onDragOver: (event: DragEvent) => {
          if (!accepts(ref)) return;
          // preventDefault is what makes an element a drop target at all.
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const edge = edgeOf(event);
          setOver((current) =>
            current && same(current.ref, ref) && current.edge === edge ? current : { ref, edge }
          );
        },
        onDragLeave: () => {
          setOver((current) => (current && same(current.ref, ref) ? null : current));
        },
        onDrop: (event: DragEvent) => {
          if (!accepts(ref) || !dragging) return;
          event.preventDefault();
          const edge = edgeOf(event);
          setArmed(null);
          setDragging(null);
          setOver(null);
          if (same(dragging, ref)) return;
          onMove(dragging, ref, edge);
        },
        ...(dropTargets ? {} : { onDragOver: undefined, onDragLeave: undefined, onDrop: undefined }),
        ...(isDragging ? { "data-dragging": "true" as const } : {}),
        ...(isOver && dropTargets ? { "data-drop": over.edge } : {}),
      };
    },
    [accepts, armed, dragging, dropTargets, mime, onMove, over, portraitClass]
  );

  return { handleProps, rowProps };
}

/**
 * Where a row lands, in the list as it will be after the row is taken out.
 *
 * The drop names a position in the list the author is LOOKING AT, which still
 * contains the dragged row. Removing it first shifts everything below by one,
 * and forgetting that is the classic off-by-one where a row dropped one place
 * down does not move at all.
 */
export function landingIndex(from: number, to: number, edge: DropEdge, sameList: boolean): number {
  const target = edge === "after" ? to + 1 : to;
  return sameList && from < target ? target - 1 : target;
}
