"use client";

/**
 * A TICK, ON ONE ROLE, ON ANDROID ONLY — AND SAYING SO IS THE POINT.
 *
 * WHAT IS ACTUALLY AVAILABLE. `navigator.vibrate` is supported by Chrome and
 * Firefox on Android and has never been supported by Safari on iOS; WebKit
 * exposes no haptic API at all. The `<input type="checkbox" switch>` trick that
 * produced Taptic feedback from iOS 17.4 was closed by Apple in iOS 26.5, so as
 * of 2026-09-10 there is no way to fire an iOS haptic from a web page.
 *
 * That single fact decides the whole design: a tick can be a layer whose
 * ABSENCE changes nothing, and it can never be the only signal that something
 * was accepted, because roughly half the readers will not receive it. Every
 * pressed control in the product answers visually first (see docs →
 * "Press is the state a finger has"); this arrives on top of that answer, for
 * the devices that can carry it.
 *
 * WHY IT BINDS TO A ROLE AND NOT TO CALL SITES. `primary` is defined as «the
 * one action that advances money or progress. Max one per view.» — which is
 * exactly the set that deserves a tick, already written down and already
 * guarded. So the contract declares `--cw-control-role: primary` on the role
 * itself and this listens for it. Nothing has to be threaded through props, no
 * list of buttons is maintained anywhere, and a CTA added next month is
 * included the moment it takes the role. Buying, starting a programme, and the
 * home page's gold CTAs are all one rule.
 *
 * WHY `pointerdown` AND NOT `click`. The tick is the tactile half of the press
 * state, not a receipt for the navigation: it says «the surface felt you», at
 * the same instant the ink runs full and the plate settles in. Most of these
 * controls are links, and a haptic on `click` fires while the page is already
 * leaving — felt during a transition, which reads as noise rather than as an
 * answer. A press that is dragged away and abandoned will have buzzed for
 * nothing, and that is the correct trade: the gesture WAS received.
 *
 * REDUCED MOTION SILENCES IT. A reader who asked their system for less
 * movement is asking about the whole sensory layer, not only about pixels — a
 * buzz is movement applied directly to the hand. Same refusal as everywhere
 * else: nothing happens, rather than something smaller.
 *
 * The duration is `--cw-haptic-tap`, read from the design tokens rather than
 * typed here, for the reason the button contract gives about every axis: one
 * that has no token is one that will diverge.
 */

const ROLE_PROPERTY = "--cw-control-role";
const HAPTIC_ROLE = "primary";
const DURATION_TOKEN = "--cw-haptic-tap";
const FALLBACK_MS = 12;

type Vibrator = { vibrate: (pattern: number | number[]) => boolean };

function vibrator(): Vibrator | null {
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (!nav || typeof (nav as Navigator & Partial<Vibrator>).vibrate !== "function") return null;
  return nav as unknown as Vibrator;
}

function movementIsWelcome(): boolean {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* No `matchMedia` worth trusting — treat it as "stay silent". The quieter
       answer is the safe one to be wrong about, same as viewTransition.ts. */
    return false;
  }
}

/* The token is a CSS time — `12ms` or `0.012s` — and Number() would return NaN
   for both. Parsed rather than assumed, and a value that does not parse falls
   back instead of throwing: a malformed token must not be able to break a tap. */
function tapDurationMs(): number {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(DURATION_TOKEN).trim();
    const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(raw);
    if (!match) return FALLBACK_MS;
    const value = Number(match[1]);
    const ms = match[2] === "s" ? value * 1000 : value;
    return ms > 0 && ms <= 100 ? Math.round(ms) : FALLBACK_MS;
  } catch {
    return FALLBACK_MS;
  }
}

function carriesHapticRole(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  try {
    /* The property inherits, so reading it on whatever child the finger landed
       on — a label span, an icon — gives the button's own role without walking
       up the tree. */
    return getComputedStyle(target).getPropertyValue(ROLE_PROPERTY).trim() === HAPTIC_ROLE;
  } catch {
    return false;
  }
}

/**
 * Installs the listener. Returns its own teardown, so the mounting component
 * is a three-line `useEffect` and this file owns every decision.
 */
export function installPressHaptics(): () => void {
  const device = vibrator();
  if (!device) return () => {};

  const onPointerDown = (event: PointerEvent) => {
    /* A secondary or middle press is not the action. */
    if (event.button !== 0) return;
    if (!movementIsWelcome()) return;
    if (!carriesHapticRole(event.target)) return;
    try {
      device.vibrate(tapDurationMs());
    } catch {
      /* Some Androids refuse while a call is active or the device is silenced.
         A refused tick is not an error worth surfacing to a buyer. */
    }
  };

  /* Capture phase: a control that calls `stopPropagation` on its own press —
     the carousel does — must not be able to swallow the tick. Passive because
     this never prevents the gesture it is reporting. */
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
}
