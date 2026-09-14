"use client";

import { useEffect } from "react";

import { installPressHaptics } from "./haptics";

/**
 * Mounts the press haptic once per platform tree. Every decision — which role,
 * which event, what silences it, why iOS gets nothing — is in `haptics.ts`.
 */
export function PressHaptics() {
  useEffect(() => installPressHaptics(), []);
  return null;
}
