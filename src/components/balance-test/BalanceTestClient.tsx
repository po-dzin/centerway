"use client";

/* The balance test — «Внутрішній простір і баланс дош».

   Built from the dosha test's parts, not beside them: the same hero intro,
   the same flow panel, the same option buttons, progress rail and result
   cards (PlatformDiagnosticStyles), so the two tests read as one instrument
   family. What is not borrowed is the state machine: nine single choices
   are scored where they are made, so the attempt is a few lines of local
   state until the last answer. Then it goes to the server once
   (`/api/tests/balance-test/complete`, scored again there) so the result can
   be kept — and, like the dosha test's, opened in full after sign-in.

   `data-dosha-test` is kept on both sections on purpose: the test surfaces'
   token scope and focus rings in globals.css key on it, and this is the same
   family of surface. The phase travels as `data-balance-phase`. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { useSession } from "@/components/auth/SessionProvider";
import { Icon } from "@/components/Icon";
import { DiagnosticIntro } from "@/components/platform/DiagnosticIntro";
import { DoshaMark } from "@/components/platform/DoshaMark";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { ProgressRail } from "@/components/platform/ProgressRail";
import { ResultGate } from "@/components/platform/ResultGate";
import { runDay, usePreviousRun, type PreviousRun } from "@/components/platform/usePreviousRun";
import { keepResult, leadSentences, readKeptResult } from "@/lib/tests/keptResult";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import {
  BALANCE_BOUNDARY_NOTE,
  BALANCE_HOW_IT_WORKS,
  BALANCE_QUESTIONS,
  BALANCE_RESULT_COPY,
  BALANCE_TEST_SLUG,
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

/* The finished result, kept for a day (lib/tests/keptResult): a reload, a Back
   from a sign-in, or a visit later brings it back. Replaced only when the next
   run finishes, so a retake never costs the result it started from. */
const KEPT_KEY = "cw_balance_result_v1";
const SESSION_KEY = "cw_balance_session_v1";
/* An unfinished run: the answers, where the reader stood, and the seed that
   orders the options — restoring answers under a reshuffled question would
   hand the reader someone else's choices. Offered on the intro, not forced. */
const DRAFT_KEY = "cw_balance_draft_v1";

type BalanceDraft = { answers: Record<string, BalanceType>; step: number; seed: string };

function readDraft(): BalanceDraft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null") as BalanceDraft | null;
    const answered = draft?.answers ? Object.keys(draft.answers).length : 0;
    return draft?.seed && answered > 0 && answered < TOTAL ? draft : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: BalanceDraft | null): void {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage refused: the run lives as long as the page.
  }
}

type KeptBalance = { attemptId: string | null; answers: Record<string, BalanceType>; seed: string };

const isAuthEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function sessionIdForAttempts(): string {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const fresh = newSeed();
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return newSeed();
  }
}

/** The answers as the server takes them: question code → the chosen option's code. */
function answerCodes(answers: Record<string, BalanceType>) {
  return BALANCE_QUESTIONS.flatMap((question) => {
    const type = answers[question.code];
    const option = question.options.find((entry) => entry.type === type);
    return option ? [{ questionCode: question.code, optionCode: option.code }] : [];
  });
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
  /* The attempt belongs to an account — from the server's answer, never from
     the mere presence of a session. */
  const [saved, setSaved] = useState(false);
  /* Saved means the run on screen is the newest row; the one before it is
     what the comparison line reads. */
  const previousRun = usePreviousRun(BALANCE_TEST_SLUG, null, phase === "result" && saved);
  const flowRef = useRef<HTMLElement>(null);
  const { session, status } = useSession();
  const signedIn = Boolean(session?.user);
  const unlocked = !isAuthEnabled || signedIn;

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

  const phaseRef = useRef<Phase>("intro");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* Hands the kept attempt to the signed-in account: the anonymous row is
     attached, or — when the anonymous save never came back — the answers are
     stored now, owned from the start. True when the server agreed. */
  const claimKept = useCallback(async (kept: KeptBalance): Promise<string | null> => {
    if (kept.attemptId) {
      const res = await authorizedFetch(`/api/test-attempts/${kept.attemptId}/attach`, { method: "POST" }).catch(
        () => null,
      );
      return res?.ok ? kept.attemptId : null;
    }
    const res = await authorizedFetch(`/api/tests/${BALANCE_TEST_SLUG}/complete`, {
      method: "POST",
      body: JSON.stringify({ sessionId: sessionIdForAttempts(), answers: answerCodes(kept.answers) }),
    }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { attemptId?: string }) : null;
    return data?.attemptId ?? null;
  }, []);

  /* THE RESULT COMES BACK, WHATEVER HAPPENED IN BETWEEN — see the dosha
     test's restore, which this mirrors. A retake in progress is left alone. */
  const restoreKept = useCallback(
    async (isSignedIn: boolean) => {
      if (phaseRef.current === "question") return;
      // An unfinished retake is newer than the kept result: the intro offers it.
      if (readDraft()) return;
      const kept = readKeptResult<KeptBalance>(KEPT_KEY);
      if (!kept || Object.keys(kept.result.answers ?? {}).length !== TOTAL) return;

      let claimed = kept.claimed;
      if (isSignedIn && !claimed) {
        const owned = await claimKept(kept.result);
        if (owned) {
          claimed = true;
          keepResult<KeptBalance>(KEPT_KEY, { ...kept.result, attemptId: owned }, true, kept.savedAt);
        }
      } else {
        await Promise.resolve();
      }

      setSeed(kept.result.seed);
      setAnswers(kept.result.answers);
      setSaved(claimed);
      setStep(TOTAL - 1);
      setPhase("result");
    },
    [claimKept],
  );

  useEffect(() => {
    if (status === "loading") return;
    void (async () => {
      await restoreKept(status === "signed-in");
    })();
  }, [status, restoreKept]);

  const retrySave = useCallback(async () => {
    const kept = readKeptResult<KeptBalance>(KEPT_KEY);
    if (!kept) return;
    const owned = await claimKept(kept.result);
    if (owned) {
      keepResult<KeptBalance>(KEPT_KEY, { ...kept.result, attemptId: owned }, true, kept.savedAt);
      setSaved(true);
    }
  }, [claimKept]);

  /* A retake starts clean on screen but leaves the kept result in place: it
     is replaced only when this run finishes. */
  /* An unfinished run found on mount, offered on the intro. */
  const [resumable, setResumable] = useState<BalanceDraft | null>(null);
  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      setResumable(readDraft());
    })();
  }, []);

  /* Every answer and every step is written down, so a reload or a locked
     phone costs nothing — the dosha test has always done this. */
  useEffect(() => {
    if (phase !== "question" || !seed) return;
    writeDraft(Object.keys(answers).length > 0 ? { answers, step, seed } : null);
  }, [answers, phase, seed, step]);

  const resume = useCallback(() => {
    if (!resumable) return;
    setSeed(resumable.seed);
    setAnswers(resumable.answers);
    setStep(Math.min(Math.max(resumable.step, 0), TOTAL - 1));
    setSaved(false);
    setResumable(null);
    setPhase("question");
  }, [resumable]);

  const start = useCallback(() => {
    writeDraft(null);
    setResumable(null);
    setSeed(newSeed());
    setAnswers({});
    setSaved(false);
    setStep(0);
    setPhase("question");
  }, []);

  /* The last answer shows the verdict at once, from the local reading, and
     keeps it before anything else; the attempt goes to the server in the
     background — completed while signed in, it is owned from the start. */
  const finish = useCallback(() => {
    setPhase("result");
    keepResult<KeptBalance>(KEPT_KEY, { attemptId: null, answers, seed }, false);
    writeDraft(null);
    void authorizedFetch(`/api/tests/${BALANCE_TEST_SLUG}/complete`, {
      method: "POST",
      body: JSON.stringify({ sessionId: sessionIdForAttempts(), answers: answerCodes(answers) }),
    })
      .then(async (res) => (res.ok ? ((await res.json()) as { attemptId?: string }) : null))
      .then((data) => {
        const id = data?.attemptId ?? null;
        setSaved(Boolean(id) && signedIn);
        if (id) keepResult<KeptBalance>(KEPT_KEY, { attemptId: id, answers, seed }, signedIn);
      })
      .catch(() => undefined);
  }, [answers, seed, signedIn]);

  const goForward = useCallback(() => {
    if (step + 1 < TOTAL) setStep(step + 1);
    else finish();
  }, [finish, step]);

  const goBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
    else setPhase("intro");
  }, [step]);

  if (phase === "intro") {
    return (
      <BalanceIntro
        author={author}
        onStart={start}
        resume={
          resumable
            ? {
                question: Math.min(Math.max(resumable.step + 1, Object.keys(resumable.answers).length + 1), TOTAL),
                total: TOTAL,
                onResume: resume,
              }
            : null
        }
      />
    );
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
              unlocked={unlocked}
              signedIn={signedIn}
              saved={saved}
              previousRun={previousRun}
              onRetrySave={() => void retrySave()}
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

function BalanceIntro({
  author,
  onStart,
  resume,
}: {
  author: Author | null;
  onStart: () => void;
  resume: { question: number; total: number; onResume: () => void } | null;
}) {
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
      resume={resume}
    />
  );
}

function BalanceResult({
  primary,
  secondary,
  scores,
  unlocked,
  signedIn,
  saved,
  previousRun,
  onRetrySave,
  onRestart,
}: {
  primary: BalanceType;
  secondary: BalanceDosha | null;
  scores: Record<BalanceType, number>;
  /** The full reading is shown: signed in, or no auth configured here. */
  unlocked: boolean;
  signedIn: boolean;
  /** The server confirmed the attempt belongs to the account. */
  saved: boolean;
  previousRun: PreviousRun | null;
  onRetrySave: () => void;
  onRestart: () => void;
}) {
  const surfaceHref = useSurfaceHref();
  const copy = BALANCE_RESULT_COPY[primary];
  const secondaryCopy = secondary ? BALANCE_RESULT_COPY[secondary] : null;
  const secondaryLabel = secondary ? BALANCE_TYPE_LABEL[secondary].toLowerCase() : null;

  return (
    <div className={styles.diagnosticFlowStack}>
      {unlocked ? (
        <div className={styles.diagnosticFlowHead}>
          <span className={styles.diagnosticStepChip}>Результат готовий</span>
        </div>
      ) : null}

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
        {/* The image line waits for the full reading: before sign-in the
            quote carries the image, and the screen has to fit one phone. */}
        {unlocked ? <p className={styles.label}>{copy.image}</p> : null}
        <blockquote>
          <p>
            <i>«{copy.quote}»</i>
          </p>
        </blockquote>
        {/* THE MEANING IS PART OF THE VERDICT. Before sign-in the reader gets
            the quote whole and the first sentence of what the state is — a
            name without its meaning is a label, not a result. */}
        {unlocked ? null : <p>{leadSentences(copy.summary, 60)}</p>}
        {unlocked ? (
          <>
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
          </>
        ) : null}
      </div>

      {unlocked ? (
        <>
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

          {/* Printed from the server's answer (see `saved`); a failed claim
              says so and offers the retry. No session, nothing to say. */}
          {signedIn ? (
            <div className={styles.card} data-tone="support">
              <p className={styles.label}>{saved ? "Результат збережено" : "Не вдалося зберегти"}</p>
              <p>
                {saved
                  ? "Стан у вашому кабінеті. Пройдіть тест знову за кілька тижнів — і побачите, що змінилося."
                  : "Результат відкрито, але в кабінет він ще не потрапив."}
              </p>
              {saved && previousRun && previousRun.reading in BALANCE_TYPE_LABEL ? (
                <p className={styles.diagnosticScoreRow}>
                  Минулого разу, {runDay(previousRun.completedAt)}:{" "}
                  {BALANCE_RESULT_COPY[previousRun.reading as BalanceType].title.toLowerCase()}
                  {previousRun.reading === primary ? " — так само, як зараз." : "."}
                </p>
              ) : null}
              {saved ? (
                <Link className={styles.diagnosticTextButton} href={surfaceHref("/profile")} data-cw-ink-control>
                  <InteractionInkLabel variant="link">Відкрити кабінет</InteractionInkLabel>
                </Link>
              ) : (
                <button type="button" className={styles.diagnosticTextButton} onClick={onRetrySave}>
                  Спробувати ще раз
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <ResultGate
          title="Увійдіть — і повний результат відкриється тут"
          includes={["Повний опис стану", "Що допоможе зараз", "Друга доша, якщо помітна", "Результат у кабінеті"]}
          onSignInStart={() => undefined}
        />
      )}

      {/* Past the door only: before sign-in the screen is the verdict and
          the gate, on one phone screen. The method's limits are already in
          the intro's «Як це працює і межі методу», and come back here with
          the full reading they qualify. */}
      {unlocked ? (
        <div className={styles.card} data-tone="policy">
          <p className={styles.label}>Межі методу</p>
          <p>{BALANCE_BOUNDARY_NOTE}</p>
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
        </>
      ) : null}

      <div className={styles.diagnosticFlowFoot}>
        <BackToTests />
        <button type="button" onClick={onRestart} className={styles.diagnosticTextButton}>
          Пройти тест ще раз
        </button>
      </div>
    </div>
  );
}
