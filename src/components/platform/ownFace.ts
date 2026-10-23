"use client";

/**
 * The signed-in person's face, the same in the top bar and in the profile
 * (G 23.10: «фото в топбаре одно, а в самом профиле другое»).
 *
 * The bar read the face from the session token, which carries the account's
 * metadata as it was when the token was issued; the profile reads the account
 * fresh. After an upload, or after the face was set from another device, the
 * two disagreed until the token was refreshed. Whichever reader knows the
 * fresh face publishes it here — the profile on load and after an upload,
 * the identity read on every session — and the bar draws that. Other tabs of
 * the same browser hear it over a BroadcastChannel.
 */

import { useSyncExternalStore } from "react";

let current: string | null | undefined;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function ensureChannel() {
  if (channel || typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel("cw-own-face");
  channel.onmessage = (event: MessageEvent<{ url: string | null }>) => {
    current = event.data?.url ?? null;
    notify();
  };
}

function subscribe(listener: () => void) {
  ensureChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Publish the fresh face; `broadcast` tells other tabs (after a change, not on a plain read). */
export function publishOwnFace(url: string | null, broadcast = false) {
  if (current === url) return;
  current = url;
  notify();
  if (broadcast) {
    ensureChannel();
    channel?.postMessage({ url });
  }
}

/** The fresh face when one is known in this tab, else the fallback (the session's). */
export function useOwnFace(fallback: string | null): string | null {
  const known = useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );
  return known === undefined ? fallback : known;
}
