/**
 * A finished test's result, kept in this browser for a day (2026-10-02).
 *
 * WHY THIS EXISTS. The result screen offers the full reading behind a sign-in.
 * The first version shelved the result in sessionStorage only on the click,
 * and read it back only once a session existed — so a reader who pressed Back
 * at the door, reloaded, or simply came back later found the intro and a test
 * to take again. A free test that ends by losing what it gave is the opposite
 * of the promise; the result now outlives every one of those.
 *
 * ONE RESULT PER TEST, REPLACED ONLY BY THE NEXT ONE FINISHED. Starting a
 * retake does not clear it: the old result stays until a new one exists, so
 * «Пройти тест ще раз» can never cost the reader anything.
 *
 * `claimed` says the attempt belongs to an account (completed while signed in,
 * or attached after). It is what «Результат збережено» is printed from — never
 * the mere presence of a session.
 *
 * localStorage, not a cookie: nothing here is for the server, and a day is
 * long enough for «I'll sign in after lunch» and short enough that a shared
 * computer does not show a stranger's reading next week. Every access is
 * guarded — storage can be disabled or full, and then the page simply behaves
 * as it did before this file.
 */

export const KEPT_RESULT_TTL_MS = 24 * 60 * 60 * 1000;

export type KeptResult<T> = { savedAt: number; claimed: boolean; result: T };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readKeptResult<T>(key: string, now: number = Date.now()): KeptResult<T> | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const kept = JSON.parse(raw) as KeptResult<T>;
    if (typeof kept?.savedAt !== "number" || !kept.result || now - kept.savedAt > KEPT_RESULT_TTL_MS) {
      store.removeItem(key);
      return null;
    }
    return kept;
  } catch {
    return null;
  }
}

export function keepResult<T>(key: string, result: T, claimed: boolean, now: number = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify({ savedAt: now, claimed, result } satisfies KeptResult<T>));
  } catch {
    // Full or refused: the result lives as long as the page, as before.
  }
}

/** Marks the kept result as owned, keeping its age: claiming is not a new result. */
export function markResultClaimed(key: string, now: number = Date.now()): void {
  const store = storage();
  const kept = readKeptResult<unknown>(key, now);
  if (!store || !kept) return;
  try {
    store.setItem(key, JSON.stringify({ ...kept, claimed: true }));
  } catch {
    // See keepResult.
  }
}

/**
 * The opening of a text that ends at a sentence: as many whole sentences as
 * fit in `max` characters, and always at least the first one. The free verdict
 * used to be clamped by CSS, which cut the balance test's quote a word before
 * its end — a teaser that reads as a mistake.
 */
export function leadSentences(text: string, max = 180): string {
  const sentences = text.match(/[^.!?…]+[.!?…]+["»”]?\s*|[^.!?…]+$/g) ?? [text];
  let out = "";
  for (const sentence of sentences) {
    if (out && (out + sentence).trim().length > max) break;
    out += sentence;
  }
  return out.trim();
}
