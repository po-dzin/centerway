"use client";

/* The balance test — «Внутрішній простір і баланс дош».

   Built from the dosha test's parts, not beside them: the same hero intro,
   the same flow panel, the same option buttons, progress rail and result
   cards (PlatformDiagnosticStyles), so the two tests read as one instrument
   family. What is not borrowed is the state machine. The dosha test keeps an
   attempt on the server because its answer key lives there and its result is
   saved to the cabinet; this one is nine single choices scored where they are
   made, so the whole attempt is a few lines of local state.

   `data-dosha-test` is kept on both sections on purpose: the test surfaces'
   token scope and focus rings in globals.css key on it, and this is the same
   family of surface. The phase travels as `data-balance-phase`. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DiagnosticIntro } from "@/components/platform/DiagnosticIntro";
import { DoshaMark } from "@/components/platform/DoshaMark";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { ProgressRail } from "@/components/platform/ProgressRail";
import {
  BALANCE_BOUNDARY_NOTE,
  BALANCE_HOW_IT_WORKS,
  BALANCE_QUESTIONS,
  BALANCE_RESULT_COPY,
  BALANCE_TYPE_LABEL,
  BALANCE_TYPES,
  BALANCE_VS_DOSHA,
  orderOptionsForAttempt,
  readBalance,
  scoreBalanceAnswers,
  type BalanceType,
  type BalanceDosha,
} from "@/lib/balance/balanceTest";
import { balanceConsultHref } from "@/lib/balance/balanceRouting";
import type { BaseDosha } from "@/lib/dosha/doshaTest";
import { platformPageArtwork } from "@/lib/platform/content";
import { DOSHA_TEST_ROUTE, TESTS_HUB_ROUTE } from "@/lib/platform/tests";
import type { Author } from "@/lms-core";

type Phase = "intro" | "question" | "result";

const TEST_TITLE = "Внутрішній простір і баланс дош";
const FONT_FAMILY = "var(--cw-font-ui), 'Manrope', 'Segoe UI', sans-serif";
const TOTAL = BALANCE_QUESTIONS.length;

/** The marks a reading is drawn with: balance is all three together. */
function marksOf(type: BalanceType): BaseDosha[] {
  return type === "balance" ? ["vata", "pitta", "kapha"] : [type];
}

function newSeed(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
}

export default function BalanceTestClient({ author = null }: { author?: Author | null }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  /* Answers by question code. A reader who walks back finds their mark where
     they left it, and changing it replaces the old one. */
  const [answers, setAnswers] = useState<Record<string, BalanceType>>({});
  const [seed, setSeed] = useState<string>("");
  const flowRef = useRef<HTMLElement>(null);

  const question = BALANCE_QUESTIONS[step];
  const options = useMemo(() => (question && seed ? orderOptionsForAttempt(question, seed) : []), [question, seed]);
  const answeredCount = Object.keys(answers).length;
  const reading = useMemo(() => readBalance(scoreBalanceAnswers(Object.values(answers))), [answers]);

  /* Each step starts at its own top: on a phone the previous question's
     buttons sit where the next question's title should be read. */
  useEffect(() => {
    if (phase === "intro") return;
    flowRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [phase, step]);

  const start = useCallback(() => {
    setSeed(newSeed());
    setAnswers({});
    setStep(0);
    setPhase("question");
  }, []);

  const goForward = useCallback(() => {
    if (step + 1 < TOTAL) setStep(step + 1);
    else setPhase("result");
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
    else setPhase("intro");
  }, [step]);

  if (phase === "intro") {
    return <BalanceIntro author={author} onStart={start} />;
  }

  return (
    <section
      ref={flowRef}
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="diagnostic-flow"
      data-cw-semantic-family="method-progress"
      data-cw-token-source="global-app-ds"
      data-dosha-test="true"
      data-balance-phase={phase}
      style={{ fontFamily: FONT_FAMILY, scrollMarginTop: "var(--cw-space-xl)" }}
    >
      <div className={styles.diagnosticStage}>
        <article className={`${styles.panel} ${styles.diagnosticPanel}`}>
          {phase === "question" && question ? (
            <div className={styles.diagnosticFlowStack}>
              <div className={styles.diagnosticFlowHead}>
                <p className={styles.label}>{TEST_TITLE}</p>
                <BackToTests />
              </div>

              <div className={styles.diagnosticProgressRow}>
                <div className={styles.diagnosticProgressMeta}>
                  <span>
                    Питання {step + 1} з {TOTAL}
                  </span>
                  <span>Прогрес {Math.round((answeredCount / TOTAL) * 100)}%</span>
                </div>
                <ProgressRail
                  value={answeredCount}
                  total={TOTAL}
                  label={`Прогрес тесту: ${answeredCount} з ${TOTAL}`}
                />
              </div>

              <div className={styles.diagnosticQuestionIntro}>
                <p className={styles.label}>{question.topic}</p>
                <h2 className={styles.title}>{question.text}</h2>
                <p className={styles.lead}>Оберіть один варіант — той, що найточніше описує останні тижні.</p>
              </div>

              <div className={styles.diagnosticOptionList}>
                {options.map((option) => {
                  const selected = answers[question.code] === option.type;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      aria-pressed={selected}
                      data-balance-option={option.code}
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.code]: option.type }))}
                      className={`cw-choice-btn ${styles.diagnosticOption}`}
                    >
                      {option.text}
                    </button>
                  );
                })}
              </div>

              <div className={styles.diagnosticStepActions}>
                <button type="button" onClick={goBack} className={styles.secondaryButton}>
                  <span>{step > 0 ? "Назад" : "До опису"}</span>
                </button>
                <button
                  type="button"
                  onClick={goForward}
                  className={styles.primaryButton}
                  disabled={!answers[question.code]}
                >
                  {step + 1 === TOTAL ? "Завершити тест" : "Далі"}
                </button>
              </div>
            </div>
          ) : null}

          {phase === "result" ? (
            <BalanceResult
              primary={reading.primary}
              secondary={reading.secondary}
              scores={reading.scores}
              onRestart={start}
            />
          ) : null}
        </article>
      </div>
    </section>
  );
}

function BackToTests() {
  return (
    <Link className={styles.diagnosticBackLink} href={TESTS_HUB_ROUTE} data-cw-ink-control>
      <Icon name="arrow-left" size={16} className={styles.diagnosticBackIcon} />
      <InteractionInkLabel variant="link">Усі тести</InteractionInkLabel>
    </Link>
  );
}

function BalanceIntro({ author, onStart }: { author: Author | null; onStart: () => void }) {
  return (
    <DiagnosticIntro
      artwork={platformPageArtwork.balance}
      imageAlt="Тест балансу дош CenterWay: вода, вугілля і квіти в рівновазі"
      phaseAttribute="data-balance-phase"
      fontFamily={FONT_FAMILY}
      badge={`${TOTAL} питань • 2-3 хв`}
      title={TEST_TITLE}
      lead="Яка стихія зараз вийшла з рівноваги, а яка тримає баланс — і що з цим робити в режимі, їжі та диханні."
      author={author}
      steps={BALANCE_HOW_IT_WORKS}
      notes={[BALANCE_VS_DOSHA]}
      boundary={BALANCE_BOUNDARY_NOTE}
      onStart={onStart}
    />
  );
}

function BalanceResult({
  primary,
  secondary,
  scores,
  onRestart,
}: {
  primary: BalanceType;
  secondary: BalanceDosha | null;
  scores: Record<BalanceType, number>;
  onRestart: () => void;
}) {
  const copy = BALANCE_RESULT_COPY[primary];
  const secondaryCopy = secondary ? BALANCE_RESULT_COPY[secondary] : null;
  const secondaryLabel = secondary ? BALANCE_TYPE_LABEL[secondary].toLowerCase() : null;

  return (
    <div className={styles.diagnosticFlowStack}>
      <div className={styles.diagnosticFlowHead}>
        <span className={styles.diagnosticStepChip}>Результат готовий</span>
      </div>

      <div className={styles.card} data-tone="support">
        <p className={styles.label}>Ваш стан зараз</p>
        <div className={styles.doshaResultHead}>
          <span className={styles.doshaMarkGroup}>
            {marksOf(primary).map((dosha) => (
              <DoshaMark key={dosha} dosha={dosha} size={56} />
            ))}
          </span>
          <h2>{copy.title}</h2>
        </div>
        <p className={styles.label}>{copy.image}</p>
        <blockquote>
          <p>
            <i>«{copy.quote}»</i>
          </p>
        </blockquote>
        <p>{copy.summary}</p>
        {/* Answers per reading, in the fixed order the readings are named in.
            Counts, not percentages: nine answers, and «4 з 9» is exactly what
            happened, where «44%» dresses it up as a measurement. */}
        <p className={styles.doshaShareRow}>
          {BALANCE_TYPES.map((type) => (
            <span key={type} className={styles.doshaShare}>
              {type === "balance" ? null : <DoshaMark dosha={type} size={32} />}
              {BALANCE_TYPE_LABEL[type]} <b>{scores[type]}</b>
            </span>
          ))}
        </p>
      </div>

      <div className={styles.card} data-tone="proof">
        <h2>Що допоможе зараз</h2>
        {copy.practices.map((practice) => (
          <p key={practice.label}>
            <b>{practice.label}.</b> {practice.text}
          </p>
        ))}
        {copy.caution ? <p className={styles.diagnosticScoreRow}>{copy.caution}</p> : null}
      </div>

      {secondaryCopy ? (
        <details className={styles.collapsibleBlock}>
          <summary className={styles.collapsibleSummary}>
            <span>Помітна також {secondaryLabel}: що з нею робити</span>
            <Icon name="chevron-down" size={18} className={styles.collapsibleMarker} />
          </summary>
          <div className={styles.card} data-tone="support">
            <p>{secondaryCopy.summary}</p>
            {secondaryCopy.practices.map((practice) => (
              <p key={practice.label}>
                <b>{practice.label}.</b> {practice.text}
              </p>
            ))}
            {secondaryCopy.caution ? <p className={styles.diagnosticScoreRow}>{secondaryCopy.caution}</p> : null}
          </div>
        </details>
      ) : null}

      <div className={styles.card} data-tone="policy">
        <p className={styles.label}>Межі методу</p>
        <p>{BALANCE_BOUNDARY_NOTE}</p>
      </div>

      <div className={styles.panelIntro}>
        <p className={styles.label}>Наступний крок</p>
      </div>

      <div className={styles.diagnosticResultActions}>
        <Link href={balanceConsultHref(primary)} className={styles.primaryButton}>
          Отримати персональні рекомендації
        </Link>
        <Link href={DOSHA_TEST_ROUTE} className={styles.secondaryButton}>
          Дізнатися свою конституцію
        </Link>
      </div>

      <p className={styles.diagnosticScoreRow}>
        Тест доші покаже природу, на якій тримається ваш стан, — разом ці два результати дають повнішу картину.
      </p>

      <div className={styles.diagnosticFlowFoot}>
        <button type="button" onClick={onRestart} className={styles.diagnosticTextButton}>
          Пройти тест ще раз
        </button>
        <BackToTests />
      </div>
    </div>
  );
}
