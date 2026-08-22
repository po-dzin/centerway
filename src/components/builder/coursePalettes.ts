/**
 * The gammas, in the author's words.
 *
 * Named here rather than in `lms-core/theme.ts` because the core is the
 * contract every renderer shares and a Ukrainian label is not part of it — and
 * named in ONE place rather than two, because the course-settings panel and the
 * create panel offer the same five choices and two lists would drift.
 */

import type { CoursePalette } from "@/lms-core";

export const PALETTE_LABELS: Record<CoursePalette, string> = {
  default: "Бренд",
  way21: "Глибока зелень",
  "reset-day": "Тепла",
  herbs: "Листяна",
  mineral: "Мінерал",
};
