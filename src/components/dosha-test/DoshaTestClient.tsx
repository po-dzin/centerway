"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { DoshaResultType } from "@/lib/doshaTest";
import { supabaseClient } from "@/lib/supabaseClient";

type TestOption = {
  id: string;
  order: number;
  code: string;
  text: string;
  mappedDosha: "vata" | "pitta" | "kapha";
};

type TestQuestion = {
  id: string;
  orderIndex: number;
  code: string;
  text: string;
  options: TestOption[];
};

type TestDefinitionResponse = {
  testId: string;
  testVersion: string;
  totalQuestions: number;
  questions: TestQuestion[];
  sessionId?: string;
};

type CompleteResponse = {
  attemptId: string;
  isCompleted: boolean;
  resultType?: DoshaResultType;
  scores: { vata: number; pitta: number; kapha: number };
  completedAt?: string;
  nextStep?: string;
};

type DraftState = {
  answers: Record<string, string>;
  currentQuestionIndex: number;
  sessionId: string;
  updatedAt: string;
};

type AttemptEventName = "dosha_result_viewed" | "dosha_followup_clicked";

type AttemptEventPayload = {
  target?: string | null;
  screen?: "intro" | "question" | "loading" | "result";
  step?: number;
  ctaTarget?: string;
  uiVariant?: string;
  resultType?: DoshaResultType;
  scores?: { vata: number; pitta: number; kapha: number };
  completedAt?: string | null;
  nextStep?: string | null;
};

const ATTEMPT_STORAGE_KEY = "centerway_dosha_test_attempt_id";
const DRAFT_STORAGE_KEY = "centerway_dosha_test_draft_v1";
const SESSION_STORAGE_KEY = "centerway_dosha_test_session_id";
const UI_VARIANT = "dosha_test_calm_route_v1";

const RESULT_COPY: Record<DoshaResultType, {
  title: string;
  summary: string;
  recommendation: string;
  weekVector: string;
}> = {
  vata: {
    title: "Вата домінує",
    summary: "Ваш ритм швидкий і чутливий до змін, тому енергія може коливатися протягом дня.",
    recommendation: "Опора на стабільність: тепла їжа, прогнозований графік і спокійний вечірній ритуал.",
    weekVector: "7-денний вектор: тримайте однаковий час сну та 1 заземлюючу практику щодня.",
  },
  pitta: {
    title: "Пітта домінує",
    summary: "Ваш профіль про інтенсивність і фокус, але ресурс відновлення потребує свідомих пауз.",
    recommendation: "Опора на баланс навантаження: охолоджувальні практики, короткі паузи, м'який темп у другій половині дня.",
    weekVector: "7-денний вектор: щодня плануйте 1 відновлювальну паузу до того, як з'явиться перевтома.",
  },
  kapha: {
    title: "Капха домінує",
    summary: "Ваш профіль дає стійкість і витривалість, але важливо підтримувати динаміку ритму.",
    recommendation: "Опора на активацію: ранній старт дня, динамічний рух і легкість у щоденному меню.",
    weekVector: "7-денний вектор: починайте ранок з 10-15 хвилин активного руху.",
  },
  vata_pitta: {
    title: "Вата + Пітта",
    summary: "Поєднання швидкості та інтенсивності: ідей багато, але ресурс потребує структурного режиму.",
    recommendation: "Опора на ритм і охолодження: чіткі блоки дня, паузи після піків навантаження.",
    weekVector: "7-денний вектор: щовечора фіксуйте 1 дію на відновлення перед сном.",
  },
  pitta_kapha: {
    title: "Пітта + Капха",
    summary: "Поєднання сили реалізації та витривалості дає великий потенціал системних змін.",
    recommendation: "Опора на гнучкість: чергуйте інтенсивні й легкі дні, щоб зберігати стабільний прогрес.",
    weekVector: "7-денний вектор: використовуйте схему 2 дні активного фокусу + 1 день м'якого відновлення.",
  },
  vata_kapha: {
    title: "Вата + Капха",
    summary: "Поєднання чутливості та стійкості може змінювати ваш темп залежно від стану відновлення.",
    recommendation: "Опора на послідовність: простий режим, регулярний рух, підтримка енергії малими кроками.",
    weekVector: "7-денний вектор: оберіть 1 стабільну ранкову і 1 вечірню практику й тримайте їх щодня.",
  },
  tridosha: {
    title: "Трідоша",
    summary: "Профіль показує близький баланс трьох дош, який добре підтримується системним ритмом.",
    recommendation: "Опора на адаптацію: коригуйте навантаження та відновлення відповідно до сезону і поточного стану.",
    weekVector: "7-денний вектор: щодня перевіряйте енергію та гнучко коригуйте інтенсивність дня.",
  },
};

function getCurrentQuestion(questions: TestQuestion[], currentQuestionIndex: number): TestQuestion | null {
  const idx = Math.max(1, currentQuestionIndex) - 1;
  return questions[idx] ?? null;
}

export default function DoshaTestClient() {
  const [phase, setPhase] = useState<"intro" | "question" | "loading" | "result">("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resultType, setResultType] = useState<DoshaResultType | null>(null);
  const [scores, setScores] = useState({ vata: 0, pitta: 0, kapha: 0 });
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultViewedSent, setResultViewedSent] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isDoshaInfoOpen, setIsDoshaInfoOpen] = useState(false);

  const currentQuestion = useMemo(
    () => getCurrentQuestion(questions, currentQuestionIndex),
    [questions, currentQuestionIndex]
  );

  const totalQuestions = questions.length || 12;

  const getOrCreateSessionId = useCallback(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() ?? `cw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  }, []);

  const saveAttemptId = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(ATTEMPT_STORAGE_KEY, id);
    if (!id) window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  const saveDraft = useCallback((draft: DraftState) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, []);

  const emitAttemptEvent = useCallback(async (eventName: AttemptEventName, payload: AttemptEventPayload = {}) => {
    if (!attemptId) return;

    await fetch(`/api/test-attempts/${attemptId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        target: payload.target ?? null,
        screen: payload.screen ?? phase,
        step: payload.step,
        ctaTarget: payload.ctaTarget,
        cta_target: payload.ctaTarget,
        uiVariant: payload.uiVariant ?? UI_VARIANT,
        ui_variant: payload.uiVariant ?? UI_VARIANT,
        resultType: payload.resultType,
        scores: payload.scores,
        completedAt: payload.completedAt,
        nextStep: payload.nextStep,
      }),
    }).catch(() => undefined);
  }, [attemptId, phase]);

  const syncPlatformUser = useCallback(async (accessToken: string) => {
    await fetch("/api/platform/users/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const bootAuth = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);
      if (data.session?.access_token) {
        await syncPlatformUser(data.session.access_token);
      }
    };
    void bootAuth();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        void syncPlatformUser(nextSession.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncPlatformUser]);

  const loadDefinition = useCallback(async (): Promise<TestDefinitionResponse | null> => {
    const readJson = async (response: Response) => {
      const data = (await response.json().catch(() => ({ error: "invalid_json" }))) as
        | TestDefinitionResponse
        | { error: string };
      if (!response.ok || "error" in data) return null;
      return data;
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch("/api/tests/dosha-test", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const data = await readJson(res);
        if (data) return data;
      } catch {
        // Retry once before fallback.
      }
    }

    // Fallback for unstable local/dev environments where GET can fail intermittently.
    try {
      const res = await fetch("/api/tests/dosha-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "dosha_test_route_fallback_start",
          sessionId: getOrCreateSessionId(),
        }),
      });
      return await readJson(res);
    } catch {
      return null;
    }
  }, [getOrCreateSessionId]);

  const completeTest = useCallback(async (finalAnswers: Record<string, string>) => {
    if (questions.length === 0) return;

    const orderedAnswers = questions.map((question) => ({
      questionId: question.id,
      optionId: finalAnswers[question.id] ?? null,
    }));

    if (orderedAnswers.some((item) => !item.optionId)) {
      setError("Не всі відповіді заповнені. Перевірте питання і завершить тест.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setPhase("loading");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/tests/dosha-test/complete", {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "dosha_test_route",
          sessionId: getOrCreateSessionId(),
          answers: orderedAnswers,
        }),
      });

      const data = (await res.json()) as CompleteResponse | { error: string };
      if (!res.ok || "error" in data || !data.isCompleted || !data.resultType) {
        setError("Не вдалося завершити тест. Спробуйте ще раз.");
        setPhase("question");
        return;
      }

      setAttemptId(data.attemptId);
      saveAttemptId(data.attemptId);
      setScores(data.scores);
      setResultType(data.resultType);
      setCompletedAt(data.completedAt ?? new Date().toISOString());
      setNextStep(data.nextStep ?? "consultation");
      setCurrentQuestionIndex(questions.length);
      setResultViewedSent(false);
      clearDraft();
      setPhase("result");
    } catch {
      setError("Помилка мережі. Спробуйте ще раз.");
      setPhase("question");
    } finally {
      setIsBusy(false);
    }
  }, [clearDraft, getOrCreateSessionId, questions, saveAttemptId, session?.access_token]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Per product decision: a full page reload always resets test state to intro.
    window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);

    setAttemptId(null);
    setQuestions([]);
    setCurrentQuestionIndex(1);
    setAnswers({});
    setResultType(null);
    setScores({ vata: 0, pitta: 0, kapha: 0 });
    setCompletedAt(null);
    setNextStep(null);
    setError(null);
    setPhase("intro");
  }, []);

  useEffect(() => {
    if (phase === "result" && resultType && resultViewedSent === false) {
      setResultViewedSent(true);
      void emitAttemptEvent("dosha_result_viewed", {
        screen: "result",
        step: totalQuestions,
        uiVariant: UI_VARIANT,
        resultType,
        scores,
        completedAt,
        nextStep,
      });
    }
  }, [completedAt, emitAttemptEvent, nextStep, phase, resultType, resultViewedSent, scores, totalQuestions]);

  const startTest = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setResultViewedSent(false);

    try {
      const data = await loadDefinition();
      if (!data) {
        setError("Не вдалося розпочати тест. Спробуйте ще раз.");
        return;
      }

      const sessionId = getOrCreateSessionId();
      saveAttemptId(null);
      setAttemptId(null);
      setQuestions(data.questions ?? []);
      setCurrentQuestionIndex(1);
      setAnswers({});
      setScores({ vata: 0, pitta: 0, kapha: 0 });
      setCompletedAt(null);
      setNextStep(null);
      setResultType(null);
      setPhase("question");
      clearDraft();
      saveDraft({
        answers: {},
        currentQuestionIndex: 1,
        sessionId,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError("Помилка мережі. Перевірте з'єднання та повторіть спробу.");
    } finally {
      setIsBusy(false);
    }
  }, [clearDraft, getOrCreateSessionId, loadDefinition, saveAttemptId, saveDraft]);

  const submitAnswer = useCallback((questionId: string, optionId: string) => {
    if (isBusy) return;
    if (answers[questionId]) return;

    const nextAnswers = { ...answers, [questionId]: optionId };
    const answeredCount = Object.keys(nextAnswers).length;
    const nextIndex = Math.min(answeredCount + 1, totalQuestions);

    setAnswers(nextAnswers);
    setCurrentQuestionIndex(nextIndex);
    setError(null);
    saveDraft({
      answers: nextAnswers,
      currentQuestionIndex: nextIndex,
      sessionId: getOrCreateSessionId(),
      updatedAt: new Date().toISOString(),
    });

    if (answeredCount >= totalQuestions) {
      void completeTest(nextAnswers);
    }
  }, [answers, completeTest, getOrCreateSessionId, isBusy, saveDraft, totalQuestions]);

  const signInWithGoogle = useCallback(async () => {
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dosha-test`,
      },
    });
  }, []);

  const progress = Math.min(100, Math.round((Math.max(0, currentQuestionIndex - 1) / totalQuestions) * 100));
  const resultCopy = resultType ? RESULT_COPY[resultType] : null;
  const testFontFamily = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif";

  return (
    <main
      className="min-h-dvh select-none px-4 py-7 sm:px-6 sm:py-10 lg:px-8"
      style={{
        fontFamily: testFontFamily,
        userSelect: "none",
        WebkitUserSelect: "none",
        background:
          "radial-gradient(1200px circle at 12% -18%, color-mix(in srgb, var(--cw-status-pending) 28%, transparent), transparent 52%), radial-gradient(1000px circle at 86% 12%, color-mix(in srgb, var(--cw-status-success) 26%, transparent), transparent 46%), linear-gradient(180deg, color-mix(in srgb, var(--cw-bg) 88%, #ffffff 12%) 0%, var(--cw-bg) 100%)",
      }}
    >
      <section className="mx-auto max-w-2xl">
        <div
          className="rounded-[2rem] border p-6 backdrop-blur-md sm:p-8"
          style={{
            borderColor: "color-mix(in srgb, var(--cw-border) 88%, #ffffff 12%)",
            background: "color-mix(in srgb, var(--cw-surface) 78%, #ffffff 22%)",
            boxShadow: "0 18px 50px color-mix(in srgb, #161410 12%, transparent)",
          }}
        >
          {phase === "intro" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3">
                <span
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.08em]"
                  style={{
                    borderColor: "var(--cw-border)",
                    background: "color-mix(in srgb, var(--cw-surface-solid) 88%, #ffffff 12%)",
                    color: "var(--cw-text)",
                  }}
                >
                  12 питань • ~2 хв
                </span>
                <button
                  type="button"
                  title={session?.user ? "Профіль" : "Увійти через Google"}
                  aria-label={session?.user ? "Профіль" : "Увійти через Google"}
                  onClick={() => {
                    if (!session?.user) void signInWithGoogle();
                  }}
                  className="cw-btn-outline inline-flex h-11 w-11 items-center justify-center rounded-full motion-reduce:transition-none"
                  style={{
                    borderColor: "var(--cw-border)",
                    background: "color-mix(in srgb, var(--cw-surface-solid) 94%, #ffffff 6%)",
                    color: "var(--cw-text)",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--cw-status-success)" }}>
                  CenterWay • Доша-тест
                </p>
                <h1
                  className="text-3xl font-bold leading-tight sm:text-4xl"
                  style={{
                    color: "var(--cw-text)",
                  }}
                >
                  Дізнайтесь ваш доша-профіль і визначте персональний вектор балансу
                </h1>
              </div>

              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "var(--cw-border)",
                  background: "color-mix(in srgb, var(--cw-accent-soft) 86%, #ffffff 14%)",
                }}
              >
                <p className="mb-3 text-sm font-semibold" style={{ color: "var(--cw-text)" }}>
                  Як це працює
                </p>
                <ol className="space-y-2 text-sm" style={{ color: "var(--cw-muted)" }}>
                  <li>1. Ви проходите 12 коротких питань про ритм, енергію та відновлення.</li>
                  <li>2. Система розраховує ваш доша-профіль за прозорою схемою балів.</li>
                  <li>3. Ви отримуєте практичний вектор на найближчі 7 днів і наступний маршрут.</li>
                </ol>
              </div>

              {error && (
                <p
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--cw-danger) 55%, var(--cw-border) 45%)",
                    color: "var(--cw-danger)",
                    background: "color-mix(in srgb, var(--cw-danger) 10%, #ffffff 90%)",
                  }}
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    void startTest();
                  }}
                  disabled={isBusy}
                  className="cw-btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isBusy ? "Запускаємо..." : "Почати тест"}
                  {!isBusy && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsDoshaInfoOpen((prev) => !prev)}
                  className="cw-btn-ghost inline-flex min-h-11 items-center px-3 text-sm font-medium underline-offset-4 motion-reduce:transition-none"
                  style={{
                    color: "var(--cw-muted)",
                  }}
                >
                  {isDoshaInfoOpen ? "Сховати опис доші" : "Що таке доша?"}
                </button>
              </div>
            </div>
          )}

          {phase === "question" && currentQuestion && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--cw-muted)" }}>
                  <span>Питання {currentQuestion.orderIndex} з {totalQuestions}</span>
                  <span>Прогрес {progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--cw-border) 72%, #ffffff 28%)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, var(--cw-status-success) 0%, color-mix(in srgb, var(--cw-status-pending) 75%, var(--cw-status-success) 25%) 100%)",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h2
                  className="text-2xl font-bold leading-snug"
                  style={{
                    color: "var(--cw-text)",
                  }}
                >
                  {currentQuestion.text}
                </h2>
                <p className="text-sm" style={{ color: "var(--cw-muted)" }}>
                  Оберіть варіант, який найточніше описує ваш поточний стан.
                </p>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const selected = answers[currentQuestion.id] === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={isBusy || Boolean(answers[currentQuestion.id])}
                      onClick={() => {
                        void submitAnswer(currentQuestion.id, option.id);
                      }}
                      className="cw-choice-btn w-full min-h-11 px-4 py-2.5 text-left text-[0.95rem] font-semibold leading-snug motion-reduce:transition-none"
                      style={{
                        color: "var(--cw-text)",
                        opacity: isBusy ? 0.86 : 1,
                        outlineColor: "transparent",
                      }}
                    >
                      {option.text}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--cw-danger) 55%, var(--cw-border) 45%)",
                    color: "var(--cw-danger)",
                    background: "color-mix(in srgb, var(--cw-danger) 10%, #ffffff 90%)",
                  }}
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 text-xs" style={{ color: "var(--cw-muted)" }}>
                <button
                  type="button"
                  onClick={() => setPhase("intro")}
                  className="cw-btn-outline inline-flex min-h-11 select-none items-center justify-center px-3 text-xs font-semibold motion-reduce:transition-none"
                  style={{
                    color: "var(--cw-text)",
                  }}
                >
                  На головну
                </button>
                <span>Режим v1: попередню відповідь змінити не можна.</span>
              </div>
            </div>
          )}

          {phase === "loading" && (
            <div className="space-y-4 py-10 text-center">
              <div
                className="mx-auto h-12 w-12 rounded-full border-4 animate-spin motion-reduce:animate-none"
                style={{ borderColor: "var(--cw-border)", borderTopColor: "var(--cw-status-success)" }}
              />
              <h2
                className="text-2xl font-bold"
                style={{
                  color: "var(--cw-text)",
                }}
              >
                Аналізуємо ваш профіль...
              </h2>
              <p className="text-sm" style={{ color: "var(--cw-muted)" }}>
                Формуємо практичний вектор і наступний маршрут у платформі.
              </p>
            </div>
          )}

          {phase === "result" && resultType && resultCopy && (
            <div className="space-y-6">
              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor: "color-mix(in srgb, var(--cw-status-success) 38%, var(--cw-border) 62%)",
                  background: "color-mix(in srgb, var(--cw-status-success-soft) 72%, #ffffff 28%)",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--cw-status-success)" }}>
                  Ваш профіль
                </p>
                <h2
                  className="mt-2 text-3xl font-bold"
                  style={{
                    color: "var(--cw-text)",
                  }}
                >
                  {resultCopy.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--cw-text)" }}>
                  {resultCopy.summary}
                </p>
                <p className="mt-3 text-sm font-medium leading-relaxed" style={{ color: "var(--cw-text)" }}>
                  {resultCopy.recommendation}
                </p>
              </div>

              <div
                className="rounded-2xl border p-4 text-sm"
                style={{ borderColor: "var(--cw-border)", background: "color-mix(in srgb, var(--cw-surface-solid) 92%, #ffffff 8%)", color: "var(--cw-text)" }}
              >
                <p className="font-semibold">Що це означає у практиці</p>
                <p className="mt-2" style={{ color: "var(--cw-muted)" }}>{resultCopy.weekVector}</p>
                <p className="mt-3" style={{ color: "var(--cw-muted)" }}>
                  Рахунок: Вата {scores.vata} • Пітта {scores.pitta} • Капха {scores.kapha}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--cw-muted)" }}>
                  Наступний крок
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href="/consult"
                    onClick={() => {
                      void emitAttemptEvent("dosha_followup_clicked", {
                        target: "consultation",
                        ctaTarget: "consultation",
                        screen: "result",
                        step: totalQuestions,
                        uiVariant: UI_VARIANT,
                        resultType,
                        scores,
                        completedAt,
                        nextStep: "consultation",
                      });
                    }}
                    className="cw-btn-primary inline-flex w-full min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold motion-reduce:transition-none"
                  >
                    Отримати персональні рекомендації
                  </a>
                  <a
                    href="/detox"
                    onClick={() => {
                      void emitAttemptEvent("dosha_followup_clicked", {
                        target: "program",
                        ctaTarget: "program",
                        screen: "result",
                        step: totalQuestions,
                        uiVariant: UI_VARIANT,
                        resultType,
                        scores,
                        completedAt,
                        nextStep: "program",
                      });
                    }}
                    className="cw-btn-outline inline-flex w-full min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold motion-reduce:transition-none"
                    style={{ color: "var(--cw-text)" }}
                  >
                    Переглянути програму
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    saveAttemptId(null);
                    setAttemptId(null);
                    setPhase("intro");
                    setResultViewedSent(false);
                  }}
                  className="cw-btn-ghost inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold underline underline-offset-4 motion-reduce:transition-none"
                  style={{ color: "var(--cw-muted)" }}
                >
                  Пройти тест ще раз
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="mx-auto mt-4 max-w-lg overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            maxHeight: isDoshaInfoOpen ? "16rem" : "0rem",
            opacity: isDoshaInfoOpen ? 1 : 0,
            transform: isDoshaInfoOpen ? "translateY(0)" : "translateY(-8px)",
          }}
          aria-hidden={!isDoshaInfoOpen}
        >
          <section
            id="what-is-dosha"
            className="rounded-2xl border p-5 text-sm leading-relaxed backdrop-blur"
            style={{
              borderColor: "var(--cw-border)",
              background: "color-mix(in srgb, var(--cw-surface) 84%, #ffffff 16%)",
              color: "var(--cw-muted)",
            }}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--cw-text)" }}>Що таке доша?</h3>
            <p className="mt-2">
              У підході CenterWay доші описують природні патерни енергії, ритму й відновлення. Тест допомагає обрати релевантний маршрут практик і контенту в платформі.
              Це wellness-орієнтир для персоналізації й не є медичним діагнозом.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
