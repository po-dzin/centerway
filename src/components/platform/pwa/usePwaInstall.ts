"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getDeferredPrompt,
  isIosSafari,
  isStandaloneDisplay,
  runInstallPrompt,
  subscribeInstall,
  wasInstalled,
} from "./installStore";

export type PwaInstallState = {
  /** Chrome/Android/desktop: a real prompt is parked and ready to fire. */
  canPrompt: boolean;
  /** iOS Safari never fires the event — the offer has to be an instruction. */
  needsIosInstructions: boolean;
  /** Already running as an installed app, so there is nothing to offer. */
  isStandalone: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

/** Snapshots must be primitives — a fresh object every read would loop. */
function snapshot() {
  const prompt = Boolean(getDeferredPrompt()) && !wasInstalled();
  return `${prompt ? 1 : 0}${isStandaloneDisplay() ? 1 : 0}${isIosSafari() ? 1 : 0}`;
}

const SERVER_SNAPSHOT = "000";

function subscribe(onChange: () => void) {
  const unsubscribe = subscribeInstall(onChange);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => {
    unsubscribe();
    media.removeEventListener("change", onChange);
  };
}

/**
 * Server and first client render agree on "nothing to offer" — the real state
 * arrives with the store subscription — so an install card never flashes for
 * someone who already installed.
 */
export function usePwaInstall(): PwaInstallState {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const install = useCallback(() => runInstallPrompt(), []);

  const canPrompt = state[0] === "1";
  const isStandalone = state[1] === "1";
  const isIos = state[2] === "1";

  return {
    canPrompt: canPrompt && !isStandalone,
    needsIosInstructions: isIos && !isStandalone && !canPrompt,
    isStandalone,
    install,
  };
}
