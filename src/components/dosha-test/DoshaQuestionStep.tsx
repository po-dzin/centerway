/* Split out of DoshaTestClient on 2026-09-13. Owns the question phase inside
   the flow panel: the head with the way back to all tests, the progress row,
   the question and its options, and the back / next pair. Stateless — the
   answers, the draft and the step moves live in useDoshaAttempt. */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { TESTS_HUB_ROUTE } from "@/lib/platform/tests";
import type { TestQuestion } from "./doshaTestApi";

type DoshaQuestionStepProps = {
  currentQuestion: TestQuestion;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
  answers: Record<string, string>;
  isBusy: boolean;
  error: string | null;
  isLastQuestion: boolean;
  currentAnswered: boolean;
  selectAnswer: (questionId: string, optionId: string) => void;
  goToStep: (nextIndex: number) => void;
  goForward: () => void;
  backToIntro: () => void;
};

export function DoshaQuestionStep({
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  progress,
  answers,
  isBusy,
  error,
  isLastQuestion,
  currentAnswered,
  selectAnswer,
  goToStep,
  goForward,
  backToIntro,
}: DoshaQuestionStepProps) {
  return (
    <div className={styles.diagnosticFlowStack}>
      <div className={styles.diagnosticFlowHead}>
        {/* A title, not a control. It was a glass pill with a touch
            target's height — the same shape the answer options and
            the buttons use — so it read as something you could
            press, and nothing happened when you did. */}
        <p className={styles.label}>Тест доші</p>
        <Link className={styles.diagnosticBackLink} href={TESTS_HUB_ROUTE} data-cw-ink-control>
          <Icon name="arrow-left" size={16} className={styles.diagnosticBackIcon} />
          <InteractionInkLabel variant="link">Усі тести</InteractionInkLabel>
        </Link>
      </div>

      <div className={styles.diagnosticProgressRow}>
        <div className={styles.diagnosticProgressMeta}>
          <span>
            Питання {currentQuestion.orderIndex} з {totalQuestions}
          </span>
          <span>Прогрес {progress}%</span>
        </div>
        <div className={styles.diagnosticProgressTrack}>
          <div
            className={styles.diagnosticProgressBar}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className={styles.diagnosticQuestionIntro}>
        <h2 className={styles.title}>{currentQuestion.text}</h2>
        <p className={styles.lead}>Оберіть варіант, який найточніше описує ваш поточний стан.</p>
      </div>

      <div className={styles.diagnosticOptionList}>
        {currentQuestion.options.map((option) => {
          const selected = answers[currentQuestion.id] === option.id;

          return (
            <button
              key={option.id}
              type="button"
              data-dosha-option={option.code}
              aria-pressed={selected}
              disabled={isBusy}
              onClick={() => {
                selectAnswer(currentQuestion.id, option.id);
              }}
              className={`cw-choice-btn ${styles.diagnosticOption}`}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      {error ? <p className={styles.diagnosticErrorNote}>{error}</p> : null}

      <div className={styles.diagnosticStepActions}>
        <button
          type="button"
          onClick={() => (currentQuestionIndex > 1 ? goToStep(currentQuestionIndex - 1) : backToIntro())}
          className={styles.secondaryButton}
          disabled={isBusy}
        >
          <span>{currentQuestionIndex > 1 ? "Назад" : "До опису"}</span>
        </button>
        <button
          type="button"
          onClick={goForward}
          className={styles.heroPrimaryButton}
          /* Off until there is something to move on from — the
             button is the answer to "what now", and lighting up is
             how it says the question is done. */
          disabled={isBusy || !currentAnswered}
        >
          {isLastQuestion ? "Завершити тест" : "Далі"}
        </button>
      </div>
    </div>
  );
}
