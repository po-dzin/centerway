"use client";

/**
 * WHAT THE LIBRARY ALREADY KNOWS.
 *
 * Every screen in the reading chain — the shelf, the course map, the lesson —
 * fetched its own data on mount and blanked itself to a full-page loader while
 * it waited. Three screens, three curtains, and the same three again on the way
 * back: stepping out of a lesson onto the shelf you were looking at a second
 * ago asked the network what that shelf held, and showed «Завантажуємо…» until
 * it answered. A reader who has already seen a page does not expect to watch it
 * be fetched again; an application that blanks it is telling them it forgot.
 *
 * So an answer is kept for as long as the tab lives, and a screen is drawn from
 * memory FIRST and corrected from the network second. Two consequences, both
 * deliberate:
 *
 *   - STALE IS SHOWN ON PURPOSE. A lesson completed a moment ago can appear
 *     un-completed for the one frame before the re-read lands. That is the
 *     right trade, because the alternative on offer is not «fresher», it is
 *     «blank». Nothing here is ever the last word on progress — the server is,
 *     and it answers a few hundred milliseconds later either way.
 *
 *   - NOTHING IS PERSISTED. No `localStorage`, no service worker, no disk. A
 *     reload is a fresh start, because a reload is what a reader does when they
 *     think something is wrong, and a memory that survived it would be one they
 *     have no way to clear. Real offline reading is a different feature with a
 *     different lifetime, and it belongs in its own cache with its own
 *     invalidation (see the note in `public/sw.js`).
 *
 * IDENTITY IS THE ONE THING IT MAY NOT GET WRONG. A module-level store has to
 * be torn down on sign-out or it leaks the previous account into the next
 * render — the exact hazard `usePlatformSession` names when it explains why two
 * auth listeners are cheaper than one shared store. So this module carries that
 * listener itself rather than asking three call sites to remember: whoever the
 * store was filled for, it empties the moment the signed-in user is somebody
 * else.
 *
 * A DRAFT PREVIEW IS NEVER REMEMBERED. An author previewing their own draft is
 * asking what it looks like NOW; handing them the copy from before their last
 * edit would make the preview a liar. The key builders below return `null` for
 * a draft, and `null` means «do not remember this», not «remember it under an
 * empty name».
 */

import { supabaseClient } from "@/lib/supabaseClient";

/* A reading session is dozens of screens, not thousands, and every entry is a
   payload the reader actually opened. The cap is here so the map is bounded
   rather than because anyone has hit it: eviction is by insertion order, and
   plain FIFO on purpose — the obvious improvement (move a key to the end when
   it is read) would mean mutating the store inside the read that
   `useSyncExternalStore` calls during render, which is exactly the kind of
   side effect that makes a snapshot untrustworthy. */
const CAPACITY = 64;

const store = new Map<string, unknown>();
const listeners = new Set<() => void>();

/** The account the store currently holds answers for. */
let filledFor: string | null = null;
let watching = false;

function announce(): void {
  for (const listener of listeners) listener();
}

/**
 * Empties the store when the signed-in account changes.
 *
 * Installed once, never removed: it lives as long as the module does, which is
 * as long as the tab does. Unsubscribing would mean tying the store's safety to
 * the lifetime of whichever component happened to mount first.
 */
function watchIdentity(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  try {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      const who = session?.user?.id ?? null;
      if (who === filledFor) return;
      filledFor = who;
      if (store.size === 0) return;
      store.clear();
      announce();
    });
  } catch {
    /* Auth is not configured on this build (the static landing bundle has no
       Supabase keys). There is no second account to leak into, and nothing to
       watch — but the flag goes back down so a later, configured surface can
       still install the watch. */
    watching = false;
  }
}

/** Subscribes to the store. The argument shape `useSyncExternalStore` wants. */
export function subscribeLibraryMemory(listener: () => void): () => void {
  watchIdentity();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The remembered answer for a key, or `undefined`.
 *
 * Safe as a `getSnapshot`: it returns the stored reference itself, so the same
 * unchanged entry is the same object on every render, and it mutates nothing.
 */
export function recall<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  return store.get(key) as T | undefined;
}

/** Remembers an answer, and tells every screen watching that it changed. */
export function remember<T>(key: string | null, value: T): void {
  if (!key) return;
  watchIdentity();
  store.delete(key);
  store.set(key, value);
  while (store.size > CAPACITY) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
  announce();
}

/** Forgets everything. Sign-out's own broom, and the tests'. */
export function forgetLibrary(): void {
  if (store.size === 0) return;
  store.clear();
  announce();
}

/* ── keys ──────────────────────────────────────────── */

export function shelfMemo(): string {
  return "shelf";
}

export function courseMemo(slug: string, draftPreview: boolean): string | null {
  return draftPreview ? null : `course:${slug}`;
}

export function lessonMemo(courseSlug: string, lessonSlug: string, draftPreview: boolean): string | null {
  return draftPreview ? null : `lesson:${courseSlug}/${lessonSlug}`;
}

/* ── warming ───────────────────────────────────────── */

/**
 * Runs when the browser has nothing better to do, or very soon.
 *
 * `requestIdleCallback` is still absent on Safari's older releases, and this is
 * a phone-first library, so the fallback is a plain timeout rather than an
 * optional feature — a prefetch that only helps on Chrome is a prefetch that
 * makes the product feel different on two devices for no stated reason.
 */
function whenIdle(run: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const idle = (window as typeof window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  }).requestIdleCallback;

  if (idle) {
    const handle = idle(run, { timeout: 2000 });
    return () => (window as typeof window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(run, 300);
  return () => window.clearTimeout(timer);
}

/** Keys already being fetched, so two screens cannot warm the same one twice. */
const inFlight = new Set<string>();

/**
 * Fetches something the reader has not asked for yet, but is about to.
 *
 * Only ever fills a gap: a key already in memory is left alone, because the
 * point is to have an answer ready, not to keep it fresh — the screen that
 * eventually reads it will revalidate on its own. Returns a canceller, so a
 * reader who leaves before the idle moment arrives never spends the request.
 */
export function warm<T>(key: string | null, load: () => Promise<{ ok: boolean; data?: T }>): () => void {
  if (!key || store.has(key) || inFlight.has(key)) return () => {};
  return whenIdle(() => {
    if (store.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    void load()
      .then((result) => {
        if (result.ok && result.data !== undefined) remember(key, result.data);
      })
      .catch(() => {
        /* A prefetch that fails is not an error the reader can act on — the
           screen they eventually open will ask again and report properly. */
      })
      .finally(() => inFlight.delete(key));
  });
}
