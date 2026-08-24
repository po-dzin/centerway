/**
 * CenterWay LMS core — public surface.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ HOUSE RULE: this directory is PURE TypeScript.                         │
 * │ No React, no Next, no DOM, no npm dependencies, no `@/` imports.       │
 * │ Enforced by `npm run guard:lms-core`.                                  │
 * │                                                                        │
 * │ Everything here must run unchanged inside Expo/React Native, so that    │
 * │ a native app (or a Telegram Mini App) is a new renderer rather than a  │
 * │ second implementation. See docs/lms-research-2026-08-15.md §5A.        │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Consumers: the seed pipeline, `/api/lms/*`, the lesson player, the reminder
 * cron, and — from H3 — the author agent's tools.
 */

export * from "./inline";
export * from "./blocks";
export * from "./course";
export * from "./readiness";
export * from "./time";
export * from "./progress";
export * from "./schedule";
export * from "./access";
export * from "./offerCode";
export * from "./theme";
export * from "./drafts";
export * from "./templates";
export * from "./portable";
export * from "./references";
