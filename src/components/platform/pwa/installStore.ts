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
/**
 * Whether a control that can actually offer installation is on screen.
 *
 * WHY THIS EXISTS. Suppressing the browser's own offer is only honest if ours
 * replaces it. The install row lives in the account menu and renders for a
 * signed-in reader on the personal origin; a GUEST there had the native prompt
 * cancelled by this module and nothing put in its place, so installation became
 * unreachable until they signed in — which is not a rule anyone decided, just
 * where a `preventDefault()` at module scope happened to land.
 *
 * So the suppression is conditional on the offer existing: `InstallEntry` marks
 * the surface while it is mounted, and `beforeinstallprompt` is only cancelled
 * while that mark is set. If the event arrives before any of ours is on screen,
 * the browser keeps its own affordance and we let it.
 */
let surfaceReady = false;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    /* Cancel the browser's own offer ONLY when ours is on screen to take its
       place (see `surfaceReady`). Parked either way: if our control mounts
       later, `install()` still has an event to fire. */
    if (surfaceReady) event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

/**
 * Declared by whichever control offers installation, for as long as it is
 * mounted. Ref-counted: two surfaces may overlap during a navigation, and the
 * first unmount must not clear the mark the second still needs.
 */
let surfaceCount = 0;

export function markInstallSurface(): () => void {
  surfaceCount += 1;
  surfaceReady = true;
  return () => {
    surfaceCount = Math.max(0, surfaceCount - 1);
    surfaceReady = surfaceCount > 0;
  };
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
