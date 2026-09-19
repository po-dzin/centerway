import type { TrailStep } from "@/components/platform/PlatformTrail";

/**
 * Where the phone's leading island goes, and the word it says.
 *
 * Pure, and out of `BuilderShell` so the rule can be tested without the
 * shell: every builder screen derives its way back from its own trail, so a
 * mistake here is a mistake on every screen at once.
 *
 * THE NEAREST STEP THAT LEADS SOMEWHERE, not the one directly above. A lesson's
 * trail is «Матеріали / Курс / Модуль / Урок» and the MODULE has no route —
 * there is no page for one — so reading `length - 2` blindly found a dead step
 * and the arrow never appeared on the screen it matters most.
 *
 * THE WORD NAMES THE LEVEL, NEVER THE TITLE (`PlatformBackOrgan`). The trail's
 * root is the workshop's own section and its label is short by construction;
 * anything deeper is a course — the only level between the root and a lesson —
 * and says «До курсу», as the reader's back control does. A course title in
 * the island came back as an ellipsis fragment wider than anything beside it.
 */
export const BACK_TO_COURSE = "До курсу";

export function leadingBack(trail: readonly TrailStep[]): { step: TrailStep; text: string } | null {
  const step =
    trail
      .slice(0, -1)
      .reverse()
      .find((candidate) => candidate.onNavigate || candidate.href) ?? null;
  if (!step) return null;
  return { step, text: trail.indexOf(step) === 0 ? step.label : BACK_TO_COURSE };
}
