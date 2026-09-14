/* Split out of DoshaTestClient on 2026-09-13. Owns the shapes the dosha test
   passes between its server calls, its storage shelves, its analytics events
   and its phase views — types only, no behaviour. */

import type { DoshaConfidence, DoshaResultType, classifyDosha } from "@/lib/dosha/doshaTest";
import type { CONFIDENCE_COPY, RESULT_COPY } from "@/lib/dosha/doshaResultCopy";

export type DoshaPhase = "intro" | "question" | "loading" | "result";

export type DoshaScores = { vata: number; pitta: number; kapha: number };

export type CompleteResponse = {
  attemptId: string;
  isCompleted: boolean;
  resultType?: DoshaResultType;
  scores: { vata: number; pitta: number; kapha: number };
  shares?: { vata: number; pitta: number; kapha: number };
  confidence?: DoshaConfidence;
  completedAt?: string;
  nextStep?: string;
};

export type PendingSave = {
  attemptId: string;
  resultType: DoshaResultType;
  scores: { vata: number; pitta: number; kapha: number };
  completedAt: string | null;
  nextStep: string | null;
};

export type DraftState = {
  /* A plain string is a draft saved before a question could take two marks. */
  answers: Record<string, string[] | string>;
  currentQuestionIndex: number;
  sessionId: string;
  updatedAt: string;
};

export type AttemptEventName = "dosha_result_viewed" | "dosha_followup_clicked";

export type AttemptEventPayload = {
  target?: string | null;
  screen?: "intro" | "question" | "loading" | "result";
  step?: number;
  ctaTarget?: string;
  uiVariant?: string;
  resultType?: DoshaResultType;
  scores?: { vata: number; pitta: number; kapha: number };
  completedAt?: string | null;
  nextStep?: string | null;
  experimentKey?: string | null;
  variantKey?: string | null;
  manifestId?: string | null;
  manifestVersion?: string | null;
  recipeVersion?: string | null;
  mode?: string | null;
  branch?: string | null;
  assignmentSource?: "bucket" | "override" | "cookie" | "default" | null;
};

export type EmitAttemptEvent = (eventName: AttemptEventName, payload?: AttemptEventPayload) => Promise<void>;

export type DoshaProfile = ReturnType<typeof classifyDosha>;
export type DoshaResultCopy = (typeof RESULT_COPY)[DoshaResultType];
export type DoshaConfidenceCopy = (typeof CONFIDENCE_COPY)[DoshaConfidence];
