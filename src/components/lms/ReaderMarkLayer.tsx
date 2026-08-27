"use client";

/**
 * The marking layer of the reader: select → mark, mark → note, note → margin.
 *
 * Everything visible here is drawn ON TOP of the lesson, never inside it. The
 * wash on the words is painted through the CSS Custom Highlight API and the
 * note dots are absolutely positioned in the column's margin, so the block tree
 * React renders is not touched by any of it — a mark cannot break a lesson, and
 * a re-render cannot break a mark.
 *
 * WHY A DOT IN THE MARGIN AND NOT AN ICON IN THE TEXT. A glyph inside the
 * sentence changes the line it is in: it takes width, it moves the words after
 * it, and on a phone it can push a line over. The margin is the place marginalia
 * has always been, and it also gives the reader the one thing a wash cannot —
 * a count they can see without reading the paragraph again.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { resolveAnchor, type Annotation, type AnnotationAnchor } from "@/lms-core";
import {
  anchorFromSelection,
  blockOf,
  clearHighlights,
  highlightsSupported,
  mapBlockText,
  paintHighlights,
  rangeFromOffsets,
} from "./readerMarks";
import styles from "./Lms.module.css";

type Pending = { anchor: AnnotationAnchor; top: number; left: number };
type Marker = { clientId: string; top: number; noted: boolean };

export function ReaderMarkLayer({
  bodyRef,
  lessonSlug,
  annotations,
  onMark,
  onSetNote,
  onRemove,
  /** Any value that changes when the body re-flows — the reader's text size. */
  layoutKey,
}: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  lessonSlug: string;
  annotations: Annotation[];
  onMark: (anchor: AnnotationAnchor, note: string | null) => Promise<string | null>;
  onSetNote: (clientId: string, note: string | null) => Promise<void>;
  onRemove: (clientId: string) => Promise<void>;
  layoutKey: string;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [editing, setEditing] = useState<{ clientId: string; draft: string } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const highlights = useMemo(
    () => annotations.filter((item) => item.kind === "highlight" && item.anchor),
    [annotations]
  );

  /**
   * Re-finds every mark in the text as it stands now, paints it, and places the
   * margin dots.
   *
   * Runs on a frame rather than straight away because it measures: the block
   * has to be laid out for a rect to mean anything, and the reader's size
   * choice re-flows the whole column.
   */
  const repaint = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    /* A HIDDEN PAGE RUNS NO FRAMES. A lesson opened in a background tab — or
       restored by the browser on start-up — would sit there with its marks
       unpainted until something else re-rendered it, so the work is done
       straight away when there is no frame to wait for, and again for real
       when the page comes back into view (the effect below). */
    const draw = () => {
      const plain: Range[] = [];
      const noted: Range[] = [];
      const nextMarkers: Marker[] = [];
      const origin = body.getBoundingClientRect().top;

      for (const item of highlights) {
        const anchor = item.anchor;
        if (!anchor) continue;
        const block = body.querySelector<HTMLElement>(`#block-${CSS.escape(anchor.blockId)}`);
        // A block the author has since removed: the mark stays in the notes
        // list as detached, and simply draws nothing here.
        if (!block) continue;
        const map = mapBlockText(block);
        const found = resolveAnchor(map.text, anchor);
        if (!found.found) continue;
        const range = rangeFromOffsets(map, found.start, found.end);
        if (!range) continue;

        if (item.note) noted.push(range);
        else plain.push(range);

        const rect = range.getBoundingClientRect();
        nextMarkers.push({
          clientId: item.clientId,
          top: rect.top - origin,
          noted: Boolean(item.note),
        });
      }

      paintHighlights(plain, noted);
      setMarkers(nextMarkers);
    };

    if (typeof document !== "undefined" && document.hidden) {
      draw();
      return undefined;
    }
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bodyRef, highlights]);

  /* The column re-flows for reasons this component never hears about — a late
     image, a font swap, a rotated phone — and a mark's rect moves with it.

     THE OBSERVER IS SUBSCRIBED ONCE and calls through a ref, deliberately: an
     effect that re-subscribes whenever `repaint` changes identity re-fires the
     observer's initial callback on every subscribe, which is a render loop
     wearing a resize observer's clothes. */
  const repaintRef = useRef(repaint);
  useEffect(() => {
    repaintRef.current = repaint;
  }, [repaint]);

  useEffect(() => {
    const cancel = repaint();
    const onVisible = () => {
      if (!document.hidden) repaintRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancel?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [repaint, layoutKey, lessonSlug]);

  // The registry is the document's, not this page's: a lesson that leaves must
  // take its marks with it or the next one paints over nodes that are gone.
  useEffect(() => () => clearHighlights(), []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => repaintRef.current());
    observer.observe(body);
    return () => observer.disconnect();
  }, [bodyRef]);

  /* ── Selecting ──────────────────────────────────── */

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const read = () => {
      const selection = document.getSelection();
      if (!selection) {
        setPending(null);
        return;
      }
      const anchor = selection.rangeCount > 0 ? anchorFromSelection(selection, body) : null;
      if (!anchor) {
        setPending(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const origin = body.getBoundingClientRect();
      setPending({
        anchor,
        top: rect.top - origin.top,
        left: Math.min(Math.max(rect.left - origin.left + rect.width / 2, 0), origin.width),
      });
    };

    // `pointerup` / `keyup`, not `selectionchange`: the toolbar must appear when
    // the reader has FINISHED choosing, not follow their finger through the
    // sentence — and on a phone the drag emits a selection change per pixel.
    const onPointerUp = () => window.setTimeout(read, 0);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", read);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", read);
    };
  }, [bodyRef]);

  const clearSelection = useCallback(() => {
    document.getSelection()?.removeAllRanges();
    setPending(null);
  }, []);

  const markPending = useCallback(
    async (withNote: boolean) => {
      if (!pending) return;
      const anchor = pending.anchor;
      clearSelection();
      const clientId = await onMark(anchor, null);
      if (withNote && clientId) setEditing({ clientId, draft: "" });
    },
    [clearSelection, onMark, pending]
  );

  /* ── Opening an existing mark ───────────────────── */

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const onClick = (event: MouseEvent) => {
      // A press that ends a selection is not a press on a mark.
      if (!document.getSelection()?.isCollapsed) return;
      if (layerRef.current?.contains(event.target as Node)) return;

      const block = blockOf(event.target as Node, body);
      if (!block) return;
      const caret = caretIndex(block.element, event.clientX, event.clientY);
      if (caret === null) return;

      const map = mapBlockText(block.element);
      for (const item of highlights) {
        if (item.anchor?.blockId !== block.id) continue;
        const found = resolveAnchor(map.text, item.anchor);
        if (!found.found) continue;
        if (caret >= found.start && caret < found.end) {
          setEditing({ clientId: item.clientId, draft: item.note ?? "" });
          return;
        }
      }
    };

    body.addEventListener("click", onClick);
    return () => body.removeEventListener("click", onClick);
  }, [bodyRef, highlights]);

  const editingAnnotation = editing
    ? annotations.find((item) => item.clientId === editing.clientId) ?? null
    : null;

  return (
    <div className={styles.markLayer} ref={layerRef}>
      {/* Dots are only drawn where the column has a margin to draw them in;
          below that the wash on the words is the whole signal, and the mark
          opens by pressing it. */}
      <div className={styles.markDots}>
        {markers
          .filter((marker) => marker.noted)
          .map((marker) => (
            <button
              key={marker.clientId}
              className={styles.markDot}
              type="button"
              style={{ top: `${marker.top}px` }}
              aria-label="Відкрити нотатку"
              /* The dot is a CONTROL, not an ornament. Pressing the marked
                 words opens the note too, but that route runs through caret
                 hit-testing and reaches nobody on a keyboard; this one is a
                 button in the tab order, which is what a note in the margin
                 has to be to count as reachable. */
              onClick={() =>
                setEditing({
                  clientId: marker.clientId,
                  draft: annotations.find((item) => item.clientId === marker.clientId)?.note ?? "",
                })
              }
            />
          ))}
      </div>

      {pending ? (
        <div
          className={styles.markToolbar}
          style={{ top: `${pending.top}px`, left: `${pending.left}px` }}
          role="toolbar"
          aria-label="Дії з виділеним текстом"
        >
          <button className={styles.markAction} type="button" onClick={() => void markPending(false)}>
            <Icon name="edit" size={16} />
            <span>Позначити</span>
          </button>
          <button className={styles.markAction} type="button" onClick={() => void markPending(true)}>
            <Icon name="quote" size={16} />
            <span>Нотатка</span>
          </button>
        </div>
      ) : null}

      {editing && editingAnnotation ? (
        <div className={styles.noteEditorBackdrop} role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget) setEditing(null);
        }}>
          <div className={styles.noteEditor} role="dialog" aria-modal="true" aria-label="Нотатка на полях">
            <p className={styles.noteQuote}>{editingAnnotation.anchor?.quote}</p>
            <textarea
              className={styles.noteInput}
              value={editing.draft}
              autoFocus
              rows={4}
              placeholder="Ваша нотатка до цього місця"
              onChange={(event) => setEditing({ clientId: editing.clientId, draft: event.target.value })}
            />
            <div className={styles.noteActions}>
              <button
                className={styles.noteDelete}
                type="button"
                onClick={() => {
                  void onRemove(editing.clientId);
                  setEditing(null);
                }}
              >
                Прибрати позначку
              </button>
              <button
                className={styles.noteSave}
                type="button"
                onClick={() => {
                  void onSetNote(editing.clientId, editing.draft.trim() ? editing.draft : null);
                  setEditing(null);
                }}
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!highlightsSupported() && highlights.length > 0 ? (
        // Said once, quietly, and only where it is true: the marks exist and are
        // listed, this browser simply cannot paint them onto the words.
        <p className={styles.markNotice}>Ваш браузер не показує підсвітку в тексті — позначки доступні у списку нотаток.</p>
      ) : null}
    </div>
  );
}

/** Where in the block's collapsed text a screen point falls. */
function caretIndex(block: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  const node = position?.offsetNode ?? doc.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
  const offset = position?.offset ?? doc.caretRangeFromPoint?.(x, y)?.startOffset ?? 0;
  if (!node || !block.contains(node)) return null;

  const map = mapBlockText(block);
  for (let i = 0; i < map.nodes.length; i += 1) {
    if (map.nodes[i] === node && map.offsets[i] >= offset) return i;
  }
  return null;
}
