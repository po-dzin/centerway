/**
 * What the reader keeps on the device.
 *
 * Two things, and both are device-shaped rather than account-shaped: where the
 * page was scrolled to, and how big the reader wants the letters. Progress —
 * what is done, what is unlocked — lives on the server and always will; a
 * scroll offset in pixels means nothing on another screen, and a size chosen
 * because you read lying down on a phone would be wrong on a desktop.
 *
 * Every access is wrapped: private mode, a full quota and a browser with site
 * data blocked all throw on `localStorage`, and none of them is a reason for a
 * lesson to fail to render.
 */

const MARK_PREFIX = "cw.reader.pos:";
const SCALE_KEY = "cw.reader.scale";

/** A month. Older than that and "where you stopped" is not a memory worth restoring. */
const MARK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Below this the mark is not worth keeping — the top of the lesson IS the top. */
export const MARK_MIN_OFFSET_PX = 320;

export type ReaderMark = {
  /** Scroll offset in pixels, at the height the document had when it was written. */
  y: number;
  /** Document height at write time, so a reflow can be corrected for. */
  h: number;
  at: number;
};

function markKey(courseSlug: string, lessonSlug: string): string {
  return `${MARK_PREFIX}${courseSlug}/${lessonSlug}`;
}

export function readMark(courseSlug: string, lessonSlug: string): ReaderMark | null {
  try {
    const raw = window.localStorage.getItem(markKey(courseSlug, lessonSlug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { y, h, at } = parsed as Partial<ReaderMark>;
    if (typeof y !== "number" || typeof h !== "number" || typeof at !== "number") return null;
    if (!Number.isFinite(y) || y < MARK_MIN_OFFSET_PX) return null;
    if (Date.now() - at > MARK_TTL_MS) {
      clearMark(courseSlug, lessonSlug);
      return null;
    }
    return { y, h, at };
  } catch {
    return null;
  }
}

export function writeMark(courseSlug: string, lessonSlug: string, mark: Omit<ReaderMark, "at">): void {
  try {
    window.localStorage.setItem(
      markKey(courseSlug, lessonSlug),
      JSON.stringify({ ...mark, at: Date.now() } satisfies ReaderMark)
    );
  } catch {
    /* Storage refused — the reader loses a convenience, not the lesson. */
  }
}

export function clearMark(courseSlug: string, lessonSlug: string): void {
  try {
    window.localStorage.removeItem(markKey(courseSlug, lessonSlug));
  } catch {
    /* see writeMark */
  }
}

/**
 * Where a saved mark lands in a document that is no longer the same height.
 *
 * Lazy images and a different viewport both change the height between visits.
 * Scaling by the ratio is not exact — nothing short of anchoring to a block id
 * would be — but it puts the reader within a screen of where they left, which
 * is the difference between "continue" and "find your place again".
 */
export function resolveMarkOffset(mark: ReaderMark, currentHeight: number): number {
  if (mark.h <= 0 || currentHeight <= 0) return mark.y;
  const ratio = currentHeight / mark.h;
  if (ratio > 0.9 && ratio < 1.1) return mark.y;
  return Math.round(mark.y * ratio);
}

/* ── Text size ────────────────────────────────────── */

export type ReaderScaleStep = { id: string; label: string; scale: number };

/** Four steps, one setting. The middle one is the design's own size. */
export const READER_SCALE_STEPS: readonly ReaderScaleStep[] = [
  { id: "s", label: "Дрібний", scale: 0.92 },
  { id: "m", label: "Звичайний", scale: 1 },
  { id: "l", label: "Великий", scale: 1.15 },
  { id: "xl", label: "Дуже великий", scale: 1.32 },
];

export const DEFAULT_READER_SCALE_ID = "m";

export function readScaleId(): string {
  try {
    const stored = window.localStorage.getItem(SCALE_KEY);
    if (stored && READER_SCALE_STEPS.some((step) => step.id === stored)) return stored;
  } catch {
    /* see writeMark */
  }
  return DEFAULT_READER_SCALE_ID;
}

/* One subscriber list, so a change made in this tab reaches the reader without
   a round trip through an effect: `storage` fires in the OTHER tabs, never in
   the one that wrote. */
const scaleListeners = new Set<() => void>();

export function subscribeScale(listener: () => void): () => void {
  scaleListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SCALE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    scaleListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeScaleId(id: string): void {
  try {
    window.localStorage.setItem(SCALE_KEY, id);
  } catch {
    /* see writeMark */
  }
  for (const listener of scaleListeners) listener();
}

/** The server knows nothing about this device, so it renders the design's own size. */
export function serverScaleId(): string {
  return DEFAULT_READER_SCALE_ID;
}

export function scaleValue(id: string): number {
  return READER_SCALE_STEPS.find((step) => step.id === id)?.scale ?? 1;
}

/**
 * Minutes left in a lesson, from the author's duration and how far down the
 * body the reader is.
 *
 * Rounded UP and never to zero while there is anything left: «залишилось ~1 хв»
 * on the last stretch is honest, «0 хв» in front of two paragraphs is not.
 */
export function minutesRemaining(durationMin: number, readingRatio: number): number {
  const left = durationMin * (1 - Math.min(1, Math.max(0, readingRatio)));
  return Math.max(1, Math.ceil(left));
}
