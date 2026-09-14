/**
 * THE FIVE TONES A STATE CAN WEAR (2026-09-14) — docs/design-system.md → «One
 * state badge».
 *
 *   neutral   a fact about where something is, with nothing to do about it
 *   running   something is under way: a review, an update, a new lead
 *   pending   someone has to act: returned with a note
 *   failed    a problem: live without review, an expired grant
 *   success   good to go: on sale, won, started
 *
 * The recipe is `globals.css` → `.cw-status-*-badge`, the one shape every
 * badge takes. The class names are written out whole, not assembled from the
 * tone, so a search for a class finds every place that prints it.
 */
export type StateTone = "neutral" | "running" | "pending" | "failed" | "success";

export const STATE_BADGE_CLASS: Record<StateTone, string> = {
  neutral: "cw-status-neutral-badge",
  running: "cw-status-running-badge",
  pending: "cw-status-pending-badge",
  failed: "cw-status-failed-badge",
  success: "cw-status-success-badge",
};
