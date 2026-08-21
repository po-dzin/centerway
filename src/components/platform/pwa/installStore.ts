"use client";

/**
 * `beforeinstallprompt` fires once, early, and is not replayed — if nothing is
 * listening at that moment the chance to offer installation is gone for the
 * page load. React components hydrate too late to rely on, so the listener is
 * attached at module evaluation and the event is parked here; the hook below
 * just reads the parked value.
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = () => void;

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppressing the mini-infobar is the price of showing the offer where it
    // belongs — in the cabinet, next to the courses the person owns.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function subscribeInstall(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDeferredPrompt() {
  return deferred;
}

export function wasInstalled() {
  return installed;
}

export async function runInstallPrompt() {
  if (!deferred) return "unavailable" as const;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  // A prompt cannot be reused, accepted or not.
  deferred = null;
  emit();
  return outcome;
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return isIos && !/crios|fxios|edgios/i.test(ua);
}
