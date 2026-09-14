"use client";

/* The dosha test, composed. Until 2026-09-13 this one file held the types, the
   storage shelves, the whole state machine and all four phases' markup — close
   to a thousand lines. It was split along the seams the code already had:
   `doshaTestTypes` and `doshaTestStorage` for shapes and shelves,
   `useDoshaAttempt` for state, server calls and effects, and one view per
   phase (`DoshaIntro`, `DoshaQuestionStep`, `DoshaLoadingStep`, `DoshaResult`).
   What stays here is the choice of phase and the flow section that frames the
   three non-intro phases. Contract tests that read this file's source read the
   extracted files with it. */

import styles from "@/components/platform/PlatformDiagnosticStyles";
import { DoshaIntro } from "./DoshaIntro";
import { DoshaLoadingStep } from "./DoshaLoadingStep";
import { DoshaQuestionStep } from "./DoshaQuestionStep";
import { DoshaResult } from "./DoshaResult";
import { useDoshaAttempt } from "./useDoshaAttempt";

const DEFAULT_UI_VARIANT = "dosha_test_calm_route_v1";

type DoshaTestClientProps = {
  uiVariant?: string;
};

export default function DoshaTestClient({ uiVariant = DEFAULT_UI_VARIANT }: DoshaTestClientProps) {
  const attempt = useDoshaAttempt(uiVariant);
  const { phase, currentQuestion, resultType, resultCopy, topbarBadge } = attempt;
  const testFontFamily = "var(--cw-font-ui), 'Manrope', 'Segoe UI', sans-serif";

  return (
    <>
      {phase === "intro" ? (
        <DoshaIntro
          fontFamily={testFontFamily}
          topbarBadge={topbarBadge}
          error={attempt.error}
          isBusy={attempt.isBusy}
          requestStartTest={attempt.requestStartTest}
        />
      ) : (
        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="diagnostic-flow"
          data-cw-semantic-family="method-progress"
          data-cw-token-source="global-app-ds"
          data-dosha-test="true"
          data-dosha-phase={phase}
          style={{
            fontFamily: testFontFamily,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <div className={styles.diagnosticStage}>
            <article className={`${styles.panel} ${styles.diagnosticPanel}`}>
              {phase === "question" && currentQuestion ? (
                <DoshaQuestionStep
                  currentQuestion={currentQuestion}
                  currentQuestionIndex={attempt.currentQuestionIndex}
                  totalQuestions={attempt.totalQuestions}
                  progress={attempt.progress}
                  answers={attempt.answers}
                  isBusy={attempt.isBusy}
                  error={attempt.error}
                  isLastQuestion={attempt.isLastQuestion}
                  currentAnswered={attempt.currentAnswered}
                  selectAnswer={attempt.selectAnswer}
                  goToStep={attempt.goToStep}
                  goForward={attempt.goForward}
                  backToIntro={attempt.backToIntro}
                />
              ) : null}

              {phase === "loading" ? <DoshaLoadingStep topbarBadge={topbarBadge} /> : null}

              {phase === "result" && resultType && resultCopy ? (
                <DoshaResult
                  topbarBadge={topbarBadge}
                  uiVariant={uiVariant}
                  attemptId={attempt.attemptId}
                  resultType={resultType}
                  resultCopy={resultCopy}
                  resultHeading={attempt.resultHeading}
                  profile={attempt.profile}
                  confidenceCopy={attempt.confidenceCopy}
                  scores={attempt.scores}
                  completedAt={attempt.completedAt}
                  nextStep={attempt.nextStep}
                  totalQuestions={attempt.totalQuestions}
                  isBusy={attempt.isBusy}
                  telegramLink={attempt.telegramLink}
                  isAuthEnabled={attempt.isAuthEnabled}
                  savedToCabinet={attempt.savedToCabinet}
                  hasSessionUser={attempt.hasSessionUser}
                  surfaceHref={attempt.surfaceHref}
                  emitAttemptEvent={attempt.emitAttemptEvent}
                  signInWithGoogle={attempt.signInWithGoogle}
                  restartTest={attempt.restartTest}
                />
              ) : null}
            </article>
          </div>
        </section>
      )}
    </>
  );
}
