/* Split out of DoshaTestClient on 2026-09-13. Owns the result phase inside
   the flow panel: the profile, what it means in practice, the method's
   boundaries, the door to the full reading (or, past it, where the result is
   kept), the two exits and the retake. Stateless — it renders what useDoshaAttempt derived
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
} from "./doshaTestTypes";
import { ResultGate, resultTeaserClassName } from "@/components/platform/ResultGate";

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
  resultType: DoshaResultType;
  resultCopy: DoshaResultCopy;
  resultHeading: string | null;
  profile: DoshaProfile;
  confidenceCopy: DoshaConfidenceCopy;
  scores: DoshaScores;
  completedAt: string | null;
  nextStep: string | null;
  totalQuestions: number;
  telegramLink: string | null;
  /** The full reading is shown: the reader is signed in, or auth is not configured here. */
  unlocked: boolean;
  savedToCabinet: boolean;
  hasSessionUser: boolean;
  surfaceHref: ReturnType<typeof useSurfaceHref>;
  emitAttemptEvent: EmitAttemptEvent;
  /** Puts the result on the shelf the page reads back after the sign-in round trip. */
  shelveForSignIn: () => void;
  restartTest: () => void;
};

export function DoshaResult({
  topbarBadge,
  uiVariant,
  resultType,
  resultCopy,
  resultHeading,
  profile,
  confidenceCopy,
  scores,
  completedAt,
  nextStep,
  totalQuestions,
  telegramLink,
  unlocked,
  savedToCabinet,
  hasSessionUser,
  surfaceHref,
  emitAttemptEvent,
  shelveForSignIn,
  restartTest,
}: DoshaResultProps) {
  return (
    <div className={styles.diagnosticFlowStack}>
      {/* The chip goes before sign-in: the locked screen is the verdict and
          the door on one phone screen, and «Результат готовий» above a
          result already on screen is the one line it can spare. */}
      {unlocked ? (
        <div className={styles.diagnosticFlowHead}>
          <span className={styles.diagnosticStepChip}>{topbarBadge}</span>
        </div>
      ) : null}

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
            and the two halves read as one run-on claim.
            Before sign-in only the first is shown: what the type is
            is the verdict, and the verdict is free. */}
        {unlocked ? (
          resultCopy.summary.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)
        ) : (
          <p className={resultTeaserClassName}>{resultCopy.summary[0]}</p>
        )}
        {unlocked ? <p>{resultCopy.recommendation}</p> : null}
      </div>

      {unlocked ? (
        <>
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

          {/* KEPT, AND SAID SO. The result has an owner by the time
              this renders, so there is nothing left to offer here but
              the way to it — and Telegram, for a reader who wants the
              profile in the chat they already use. */}
          <div className={styles.card} data-tone="support">
            <p className={styles.label}>Результат збережено</p>
            <p>
              {savedToCabinet || hasSessionUser
                ? "Профіль у вашому кабінеті — поруч із програмами і прогресом. Наступне проходження покаже, як він змінюється."
                : "Профіль відкрито."}
            </p>
            <Link className={styles.diagnosticTextButton} href={surfaceHref("/profile")} data-cw-ink-control>
              <InteractionInkLabel variant="link">Відкрити кабінет</InteractionInkLabel>
            </Link>
            {telegramLink ? (
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
            ) : null}
          </div>
        </>
      ) : (
        <ResultGate
          title="Увійдіть, щоб відкрити повний профіль"
          includes={["Співвідношення дош", "Ваш тип поза рівновагою", "Вектор на тиждень", "Профіль у кабінеті"]}
          onBeforeLeave={() => {
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
            shelveForSignIn();
          }}
        />
      )}

      {/* Past the door only: before sign-in the screen is the verdict and
          the gate, on one phone screen. The method's limits are already in
          the intro's «Як це працює і межі методу», and come back here with
          the full reading they qualify. */}
      {unlocked ? (
        <div className={styles.card} data-tone="policy">
          <p className={styles.label}>Межі методу</p>
          <p>{BOUNDARY_NOTE}</p>
        </div>
      ) : null}

      {/* THE NEXT STEP IS PAST THE DOOR (2026-10-02). Before sign-in the
          screen has one step to offer, and it is the gate above: a
          consultation or a programme beside it splits a reader who has not
          yet seen their own reading between three exits. */}
      {unlocked ? (
        <>
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
        </>
      ) : null}

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
