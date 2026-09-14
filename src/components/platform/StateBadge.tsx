import type { ReactNode } from "react";

import { COURSE_STATE_TONES, courseStateLabel, type CourseStateKey } from "@/lib/lms/courseState";
import { STATE_BADGE_CLASS, type StateTone } from "@/lib/platform/stateTone";

/**
 * ONE STATE BADGE (2026-09-14). A word in a capsule that says where something
 * stands — never a control, never a button. Five tones, one shape, from the
 * `.cw-status-*-badge` recipe in globals.css.
 *
 * It replaces five recipes that named the same states differently: the admin's
 * uppercase paper `.tag`, the builder's uppercase monospace `.pill` (gold when
 * published), three one-off admin chips, and the success badge the leads list
 * already used. «Опубліковано» looked one way in the admin and another in the
 * builder, and «ready» was green in one and gold in the other.
 *
 * A status printed over a PHOTOGRAPH is not this badge: it is `mediaBadge`
 * (docs/design-system.md → «Boundary hierarchy»), because a tinted wash over an
 * image is not a ground.
 */
export function StateBadge({ tone = "neutral", children }: { tone?: StateTone; children: ReactNode }) {
  return <span className={STATE_BADGE_CLASS[tone]}>{children}</span>;
}

/** A course's lifecycle state: the word and its tone, both from `courseState.ts`. */
export function CourseStateBadge({ state, lang }: { state: CourseStateKey; lang: string }) {
  return <StateBadge tone={COURSE_STATE_TONES[state]}>{courseStateLabel(state, lang)}</StateBadge>;
}
