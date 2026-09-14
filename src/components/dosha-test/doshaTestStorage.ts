/* Split out of DoshaTestClient on 2026-09-13. Owns the dosha test's browser
   shelves: the storage keys, and the plain read/write helpers for the session
   id, the attempt id and the draft. No React here — the hook wraps these so
   their identities stay as stable as they were. */

import type { DraftState } from "./doshaTestTypes";

export const ATTEMPT_STORAGE_KEY = "centerway_dosha_test_attempt_id";
export const DRAFT_STORAGE_KEY = "centerway_dosha_test_draft_v1";
export const SESSION_STORAGE_KEY = "centerway_dosha_test_session_id";
/* The result has to survive the round trip to Google and back: the page
   reloads, state is gone, and the attempt it belongs to is anonymous until we
   say otherwise. sessionStorage is the right shelf — same tab, one journey. */
export const PENDING_SAVE_KEY = "centerway_dosha_test_pending_save";

export function getOrCreateStoredSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const generated = window.crypto?.randomUUID?.() ?? `cw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function storeAttemptId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ATTEMPT_STORAGE_KEY, id);
  if (!id) window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
}

export function removeStoredDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function storeDraft(draft: DraftState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}
