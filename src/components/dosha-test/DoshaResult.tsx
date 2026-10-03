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
import type {
  DoshaConfidenceCopy,
  DoshaProfile,
  DoshaResultCopy,
  DoshaScores,
  EmitAttemptEvent,
} from "./doshaTestTypes";
import { ResultGate } from "@/components/platform/ResultGate";
import { formatDoshaResult } from "@/components/platform/cabinet/format";
import { runDay, type PreviousRun } from "@/components/platform/usePreviousRun";
import { leadSentences } from "@/lib/tests/keptResult";

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
  /** The reader's run before this one, for the comparison line. */
  previousRun: PreviousRun | null;
  hasSessionUser: boolean;
  emitAttemptEvent: EmitAttemptEvent;
  /** Claims the attempt again after a failed save. */
  retrySave: () => Promise<void>;
  restartTest: () => void;
};

export function DoshaResult({
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
  previousRun,
  hasSessionUser,
  emitAttemptEvent,
  retrySave,
  restartTest,
}: DoshaResultProps) {
  return (
    <div className={styles.diagnosticFlowStack}>
      {/* No step chip above the result (2026-10-03): «Результат готовий»
          over a result already on screen, under «Ваш профіль» a line below,
          said the same thing twice. It went before sign-in first; G called
          the signed-in page overloaded, so it is gone on both. */}
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
          <p>{leadSentences(resultCopy.summary[0] ?? "")}</p>
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

          {/* SAVED ONLY WHEN THE SERVER SAID SO. «Результат збережено»
              is printed from the claim's answer, not from the presence
              of a session; a failed claim says so and offers the retry.
              Without a session (auth not configured here) there is
              nothing to say about keeping, so the card is absent. */}
          {/* Kept, said in one line, with the two ways onward as links on
              one row (2026-10-03). This was a card of its own — a label, a
              paragraph about the cabinet, the comparison, a link and a
              full-width Telegram button — and it was most of what made the
              signed-in page read as overloaded. The paragraph only explained
              the label, so it stays only where something went wrong. */}
          {hasSessionUser ? (
            <div className={styles.diagnosticKept}>
              <p className={styles.label}>{savedToCabinet ? "Результат збережено" : "Не вдалося зберегти"}</p>
              {savedToCabinet ? null : <p>Профіль відкрито, але в кабінет він ще не потрапив.</p>}
              {/* WHAT CHANGED. Retaking is sold by the hub and the cabinet as
                  the way to see a change; this is the line that shows it. */}
              {savedToCabinet && previousRun ? (
                <p>
                  Минулого разу, {runDay(previousRun.completedAt)}: {formatDoshaResult(previousRun.reading, "uk")}
                  {previousRun.reading === resultType ? " — так само, як зараз." : "."}
                </p>
              ) : null}
              <div className={styles.diagnosticKeptLinks}>
                {/* No way into the cabinet from here (2026-10-03): the result is kept
                   there already, and a link out of the flow is noise beside the next
                   step. G: «убрать переход в кабинет (лишний шум)». */}
                {savedToCabinet ? null : (
                  <button type="button" className={styles.diagnosticTextButton} onClick={() => void retrySave()}>
                    Спробувати ще раз
                  </button>
                )}
                {telegramLink ? (
                  <a
                    className={styles.diagnosticTextButton}
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cw-ink-control
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
                    <InteractionInkLabel variant="link">Надіслати в Telegram</InteractionInkLabel>
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <ResultGate
          title="Увійдіть — і повний профіль відкриється тут"
          includes={["Співвідношення дош", "Ваш тип поза рівновагою", "Вектор на тиждень", "Профіль у кабінеті"]}
          onSignInStart={() => {
            void emitAttemptEvent("dosha_followup_clicked", {
              target: "save_result_signin",
              ctaTarget: "save_result_signin",
              screen: "result",
              step: totalQuestions,
              uiVariant,
              resultType,
              scores,
              completedAt,
              nextStep,
            });
          }}
        />
      )}

      {/* THE NEXT STEP IS PAST THE DOOR (2026-10-02). Before sign-in the
          screen has one step to offer, and it is the gate above: a
          consultation or a programme beside it splits a reader who has not
          yet seen their own reading between three exits. */}
      {unlocked ? (
        <>
          {/* No «Наступний крок» heading over the two buttons (2026-10-03):
              they are the next step, and say which. */}
          {/* THE PROGRAMME LEADS (2026-10-03). The reading is used inside «Шлях
              21» from its first day, so it is the step the result points to;
              the consultation stays beside it for whoever wants it in person. */}
          <div className={styles.diagnosticResultActions}>
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
              className={styles.primaryButton}
            >
              Переглянути програму
            </Link>
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
              className={styles.secondaryButton}
            >
              Отримати персональні рекомендації
            </Link>
          </div>

          {/* ONE PROGRAM, NOT SEVEN. The type does not pick a different
            product — it is read inside the one program — so the screen
            says that plainly instead of implying a personalised
            catalogue it does not have. */}
          <p className={styles.diagnosticFinePrint}>
            Програма одна для всіх типів: доші враховані всередині неї, тож ваш профіль стане в пригоді з першого дня.
          </p>

          {/* THE METHOD'S LIMITS, AS THE PAGE'S FINE PRINT (2026-10-03). It
              was a tinted card between the reading and the next step — the
              loudest block on the page for the one thing a reader needs to
              have been told, not to act on. Past the door only, as before:
              the intro's «Як це працює і межі методу» carries it until then. */}
          <p className={styles.diagnosticFinePrint}>
            <span className={styles.label}>Межі методу.</span> {BOUNDARY_NOTE}
          </p>
        </>
      ) : null}

      {/* The way back on the left, where its arrow points; the act on the
          right, where actions sit on this platform. */}
      <div className={styles.diagnosticFlowFoot}>
        <Link className={styles.diagnosticBackLink} href={TESTS_HUB_ROUTE} data-cw-ink-control>
          <Icon name="arrow-left" size={16} className={styles.diagnosticBackIcon} />
          <InteractionInkLabel variant="link">Усі тести</InteractionInkLabel>
        </Link>
        <button type="button" onClick={restartTest} className={styles.diagnosticTextButton}>
          Пройти тест ще раз
        </button>
      </div>
    </div>
  );
}
