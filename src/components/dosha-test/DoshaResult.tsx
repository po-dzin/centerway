/* Split out of DoshaTestClient on 2026-09-13. Owns the result phase inside
   the flow panel: the profile, what it means in practice, the method's
   boundaries, the ways to keep the result (Telegram, the cabinet), the two
   exits and the retake. Stateless — it renders what useDoshaAttempt derived
   and fires the follow-up events through the callbacks it is handed. */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import type { BaseDosha, DoshaResultType } from "@/lib/dosha/doshaTest";
import { DoshaMark } from "@/components/platform/DoshaMark";
import { BOUNDARY_NOTE } from "@/lib/dosha/doshaResultCopy";
import { DOSHA_PRIMARY_EXIT, DOSHA_SECONDARY_EXIT, doshaExitHref } from "@/lib/dosha/doshaRouting";
import { TESTS_HUB_ROUTE } from "@/lib/platform/tests";
import type { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type {
  DoshaConfidenceCopy,
  DoshaProfile,
  DoshaResultCopy,
  DoshaScores,
  EmitAttemptEvent,
  PendingSave,
} from "./doshaTestTypes";

/** The share row's fixed order — the order the doshas are always named in. */
const DOSHA_SHARE_ORDER: { dosha: BaseDosha; label: string }[] = [
  { dosha: "vata", label: "Вата" },
  { dosha: "pitta", label: "Пітта" },
  { dosha: "kapha", label: "Капха" },
];

/**
 * The doshas the VERDICT names, in the verdict's own order.
 *
 * Not "the ones with the highest share": the classifier has already decided
 * what this reading is, and a mark that disagreed with the heading beside it
 * would be a second opinion on the same screen. `tridosha` names all three,
 * because that is what the word means.
 */
function doshasOfType(type: DoshaResultType): BaseDosha[] {
  if (type === "tridosha") return ["vata", "pitta", "kapha"];
  return type.split("_") as BaseDosha[];
}

type DoshaResultProps = {
  topbarBadge: string;
  uiVariant: string;
  attemptId: string | null;
  resultType: DoshaResultType;
  resultCopy: DoshaResultCopy;
  resultHeading: string | null;
  profile: DoshaProfile;
  confidenceCopy: DoshaConfidenceCopy;
  scores: DoshaScores;
  completedAt: string | null;
  nextStep: string | null;
  totalQuestions: number;
  isBusy: boolean;
  telegramLink: string | null;
  isAuthEnabled: boolean;
  savedToCabinet: boolean;
  hasSessionUser: boolean;
  surfaceHref: ReturnType<typeof useSurfaceHref>;
  emitAttemptEvent: EmitAttemptEvent;
  signInWithGoogle: (pendingSave?: PendingSave) => Promise<void>;
  restartTest: () => void;
};

export function DoshaResult({
  topbarBadge,
  uiVariant,
  attemptId,
  resultType,
  resultCopy,
  resultHeading,
  profile,
  confidenceCopy,
  scores,
  completedAt,
  nextStep,
  totalQuestions,
  isBusy,
  telegramLink,
  isAuthEnabled,
  savedToCabinet,
  hasSessionUser,
  surfaceHref,
  emitAttemptEvent,
  signInWithGoogle,
  restartTest,
}: DoshaResultProps) {
  return (
    <div className={styles.diagnosticFlowStack}>
      <div className={styles.diagnosticFlowHead}>
        <span className={styles.diagnosticStepChip}>{topbarBadge}</span>
      </div>

      <div className={styles.card} data-tone="support">
        <p className={styles.label}>Ваш профіль</p>
        {/* The mark says the verdict before the words do, and says
            it in the dosha's own colour — one mark for a single
            type, two for a pair, three for tridosha. */}
        <div className={styles.doshaResultHead}>
          <span className={styles.doshaMarkGroup}>
            {doshasOfType(resultType).map((dosha) => (
              <DoshaMark key={dosha} dosha={dosha} size={56} />
            ))}
          </span>
          <h2>{resultHeading}</h2>
        </div>
        {/* The summary is paragraphs, not one string: what the type
            IS, then what it looks like out of balance. Rendered as
            one <p> the break between them collapsed into a space
            and the two halves read as one run-on claim. */}
        {resultCopy.summary.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <p>{resultCopy.recommendation}</p>
      </div>

      <div className={styles.card} data-tone="proof">
        <h2>Що це означає у практиці</h2>
        <p>{resultCopy.weekVector}</p>
        {/* Percentages, because the verdict is drawn on percentages:
            the row used to show three near-equal counts under a
            headline that claimed one of them dominated. */}
        <p className={styles.doshaShareRow}>
          {DOSHA_SHARE_ORDER.map(({ dosha, label }) => (
            <span key={dosha} className={styles.doshaShare}>
              <DoshaMark dosha={dosha} size={32} />
              {label} <b>{profile.shares[dosha]}%</b>
            </span>
          ))}
        </p>
        <p className={styles.diagnosticScoreRow}>{confidenceCopy.label}</p>
        {confidenceCopy.note ? <p>{confidenceCopy.note}</p> : null}
      </div>

      <div className={styles.card} data-tone="policy">
        <p className={styles.label}>Межі методу</p>
        <p>{BOUNDARY_NOTE}</p>
      </div>

      {/* THE STEP THAT WAS MISSING. Between «I know my type» and
          «I pay» there was nothing at all: two heavy exits and no
          way to keep what you had just been given. Signing in here
          is the cheap step — it saves the result, and it is the
          first point in the journey where an account buys the
          reader something rather than costing them the test. */}
      <div className={styles.card} data-tone="support">
        <p className={styles.label}>Зберегти результат</p>
        {/* TELEGRAM FIRST, ACCOUNT SECOND. Both are the cheap step,
            but one of them costs a tap and the other costs a
            sign-in — and the chat works for a reader who has no
            account and does not want one yet. */}
        {telegramLink ? (
          <>
            <p>Надішлемо профіль у Telegram — щоб він залишився під рукою разом із коротким вектором на тиждень.</p>
            <a
              className={styles.secondaryButton}
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void emitAttemptEvent("dosha_followup_clicked", {
                  target: "save_result_telegram",
                  ctaTarget: "save_result_telegram",
                  screen: "result",
                  step: totalQuestions,
                  uiVariant,
                  resultType,
                  scores,
                  completedAt,
                  nextStep,
                });
              }}
            >
              Надіслати в Telegram
            </a>
          </>
        ) : null}

        {isAuthEnabled ? (
          savedToCabinet || hasSessionUser ? (
            <>
              <p>Результат збережено у вашому кабінеті — його видно поруч із програмами і прогресом.</p>
              <Link className={styles.diagnosticTextButton} href={surfaceHref("/profile")} data-cw-ink-control>
                <InteractionInkLabel variant="link">Відкрити кабінет</InteractionInkLabel>
              </Link>
            </>
          ) : (
            <>
              <p>Результат зберігається у кабінеті: до нього можна повернутись і порівняти з наступним проходженням.</p>
              <button
                type="button"
                className={styles.diagnosticTextButton}
                disabled={isBusy}
                onClick={() => {
                  void emitAttemptEvent("dosha_followup_clicked", {
                    target: "save_result",
                    ctaTarget: "save_result",
                    screen: "result",
                    step: totalQuestions,
                    uiVariant,
                    resultType,
                    scores,
                    completedAt,
                    nextStep,
                  });
                  void signInWithGoogle(
                    attemptId ? { attemptId, resultType, scores, completedAt, nextStep } : undefined,
                  );
                }}
              >
                Зберегти у кабінеті
              </button>
            </>
          )
        ) : null}
      </div>

      <div className={styles.panelIntro}>
        <p className={styles.label}>Наступний крок</p>
      </div>

      <div className={styles.diagnosticResultActions}>
        <Link
          href={doshaExitHref(DOSHA_PRIMARY_EXIT, { resultType, confidence: profile.confidence })}
          onClick={() => {
            void emitAttemptEvent("dosha_followup_clicked", {
              target: DOSHA_PRIMARY_EXIT.target,
              ctaTarget: DOSHA_PRIMARY_EXIT.ctaTarget,
              screen: "result",
              step: totalQuestions,
              uiVariant,
              resultType,
              scores,
              completedAt,
              nextStep: DOSHA_PRIMARY_EXIT.nextStep,
            });
          }}
          className={styles.primaryButton}
        >
          Отримати персональні рекомендації
        </Link>
        <Link
          href={doshaExitHref(DOSHA_SECONDARY_EXIT, { resultType, confidence: profile.confidence })}
          onClick={() => {
            void emitAttemptEvent("dosha_followup_clicked", {
              target: DOSHA_SECONDARY_EXIT.target,
              ctaTarget: DOSHA_SECONDARY_EXIT.ctaTarget,
              screen: "result",
              step: totalQuestions,
              uiVariant,
              resultType,
              scores,
              completedAt,
              nextStep: DOSHA_SECONDARY_EXIT.nextStep,
            });
          }}
          className={styles.secondaryButton}
        >
          Переглянути програму
        </Link>
      </div>

      {/* ONE PROGRAM, NOT SEVEN. The type does not pick a different
          product — it is read inside the one program — so the screen
          says that plainly instead of implying a personalised
          catalogue it does not have. */}
      <p className={styles.diagnosticScoreRow}>
        Програма одна для всіх типів: доші враховані всередині неї, тож ваш профіль стане в пригоді з першого дня.
      </p>

      <div className={styles.diagnosticFlowFoot}>
        <button type="button" onClick={restartTest} className={styles.diagnosticTextButton}>
          Пройти тест ще раз
        </button>
        <Link className={styles.diagnosticBackLink} href={TESTS_HUB_ROUTE} data-cw-ink-control>
          <Icon name="arrow-left" size={16} className={styles.diagnosticBackIcon} />
          <InteractionInkLabel variant="link">Усі тести</InteractionInkLabel>
        </Link>
      </div>
    </div>
  );
}
