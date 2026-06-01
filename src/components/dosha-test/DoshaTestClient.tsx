"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { PlatformAuthModal } from "@/components/platform/PlatformAuthModal";
import styles from "@/components/platform/PlatformContentStyles";
import type { DoshaResultType } from "@/lib/doshaTest";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";
import { CW_THEME_QUERY_KEYS } from "@/lib/generator/theme";
import { DOSHA_PRIMARY_EXIT, DOSHA_SECONDARY_EXIT } from "@/lib/doshaRouting";
import { platformPageArtwork } from "@/lib/platform/content";
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
  experimentKey?: string | null;
  variantKey?: string | null;
  manifestId?: string | null;
  manifestVersion?: string | null;
  recipeVersion?: string | null;
  mode?: string | null;
  branch?: string | null;
  assignmentSource?: "bucket" | "override" | "cookie" | "default" | null;
};

const ATTEMPT_STORAGE_KEY = "centerway_dosha_test_attempt_id";
const DRAFT_STORAGE_KEY = "centerway_dosha_test_draft_v1";
const SESSION_STORAGE_KEY = "centerway_dosha_test_session_id";
const PENDING_START_KEY = "centerway_dosha_test_pending_start";
const DEFAULT_UI_VARIANT = "dosha_test_calm_route_v1";

type DoshaTestClientProps = {
  uiVariant?: string;
  generatorContext?: GeneratorAnalyticsContext;
};

const RESULT_COPY: Record<
  DoshaResultType,
  {
    title: string;
    summary: string;
    recommendation: string;
    weekVector: string;
  }
> = {
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

function resolveHeroPosition(position?: string) {
  if (!position) {
    return {
      x: "50%",
      y: "20%",
    };
  }
  const [x, y] = position.trim().split(/\s+/);
  return {
    x: x === "center" ? "50%" : x,
    y: y ?? "20%",
  };
}

function getCurrentQuestion(questions: TestQuestion[], currentQuestionIndex: number): TestQuestion | null {
  const idx = Math.max(1, currentQuestionIndex) - 1;
  return questions[idx] ?? null;
}

export default function DoshaTestClient({ uiVariant = DEFAULT_UI_VARIANT, generatorContext }: DoshaTestClientProps) {
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
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isDoshaInfoOpen, setIsDoshaInfoOpen] = useState(false);
  const isAuthEnabled = useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    []
  );

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
        uiVariant: payload.uiVariant ?? uiVariant,
        ui_variant: payload.uiVariant ?? uiVariant,
        resultType: payload.resultType,
        scores: payload.scores,
        completedAt: payload.completedAt,
        nextStep: payload.nextStep,
        experimentKey: payload.experimentKey ?? generatorContext?.experiment_key ?? null,
        variantKey: payload.variantKey ?? generatorContext?.variant_key ?? null,
        manifestId: payload.manifestId ?? generatorContext?.manifest_id ?? null,
        manifestVersion: payload.manifestVersion ?? generatorContext?.manifest_version ?? null,
        recipeVersion: payload.recipeVersion ?? generatorContext?.recipe_version ?? null,
        mode: payload.mode ?? generatorContext?.mode ?? null,
        branch: payload.branch ?? generatorContext?.branch ?? null,
        assignmentSource: payload.assignmentSource ?? generatorContext?.assignment_source ?? null,
      }),
    }).catch(() => undefined);
  }, [attemptId, generatorContext?.assignment_source, generatorContext?.branch, generatorContext?.experiment_key, generatorContext?.manifest_id, generatorContext?.manifest_version, generatorContext?.mode, generatorContext?.recipe_version, generatorContext?.variant_key, phase, uiVariant]);

  const syncPlatformUser = useCallback(async (accessToken: string) => {
    await fetch("/api/platform/users/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => undefined);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PENDING_START_KEY, "1");
    }

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}` : undefined;

    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  }, []);

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
      setNextStep(data.nextStep ?? DOSHA_PRIMARY_EXIT.nextStep);
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

  const runStartFlow = useCallback(async () => {
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

  const resumePendingStartIfNeeded = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token || typeof window === "undefined") return;
    if (window.sessionStorage.getItem(PENDING_START_KEY) !== "1") return;

    window.sessionStorage.removeItem(PENDING_START_KEY);
    setShowAuthPrompt(false);
    await syncPlatformUser(nextSession.access_token);
    await runStartFlow();
  }, [runStartFlow, syncPlatformUser]);

  useEffect(() => {
    const bootAuth = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);
      if (data.session?.access_token) {
        await syncPlatformUser(data.session.access_token);
        await resumePendingStartIfNeeded(data.session);
      }
    };
    void bootAuth();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        setShowAuthPrompt(false);
        return;
      }

      void (async () => {
        await syncPlatformUser(nextSession.access_token);
        await resumePendingStartIfNeeded(nextSession);
      })();
    });

    return () => subscription.unsubscribe();
  }, [resumePendingStartIfNeeded, syncPlatformUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;

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
    setShowAuthPrompt(false);
    setPhase("intro");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    let changed = false;

    for (const key of CW_THEME_QUERY_KEYS) {
      if (!url.searchParams.has(key)) continue;
      url.searchParams.delete(key);
      changed = true;
    }

    if (!changed) return;
    const search = url.searchParams.toString();
    window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!showAuthPrompt) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAuthPrompt(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAuthPrompt]);

  useEffect(() => {
    if (phase === "result" && resultType && resultViewedSent === false) {
      setResultViewedSent(true);
      void emitAttemptEvent("dosha_result_viewed", {
        screen: "result",
        step: totalQuestions,
        uiVariant,
        resultType,
        scores,
        completedAt,
        nextStep,
      });
    }
  }, [completedAt, emitAttemptEvent, nextStep, phase, resultType, resultViewedSent, scores, totalQuestions, uiVariant]);

  const requestStartTest = useCallback(async () => {
    setShowAuthPrompt(false);

    if (!isAuthEnabled) {
      await runStartFlow();
      return;
    }

    const authState = await supabaseClient.auth.getSession();
    const activeSession = authState.data.session ?? session;
    if (!activeSession?.access_token) {
      setShowAuthPrompt(true);
      return;
    }

    setSession(activeSession);
    await syncPlatformUser(activeSession.access_token);
    await runStartFlow();
  }, [isAuthEnabled, runStartFlow, session, syncPlatformUser]);

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

  const progress = Math.min(100, Math.round((Math.max(0, currentQuestionIndex - 1) / totalQuestions) * 100));
  const resultCopy = resultType ? RESULT_COPY[resultType] : null;
  const testFontFamily = "var(--cw-font-ui), 'Manrope', 'Segoe UI', sans-serif";
  const topbarBadge = phase === "intro"
    ? "12 питань • 3-5 хв"
    : phase === "question"
      ? `Питання ${currentQuestion?.orderIndex ?? currentQuestionIndex} з ${totalQuestions}`
        : phase === "loading"
          ? "Формуємо результат"
          : "Результат готовий";
  const doshaHeroArtwork = platformPageArtwork.dosha;
  const desktopFocus = resolveHeroPosition(doshaHeroArtwork.desktopPosition);
  const mobileFocus = resolveHeroPosition(doshaHeroArtwork.mobilePosition ?? doshaHeroArtwork.desktopPosition);
  const heroStyle = {
    "--hero-photo-x": desktopFocus.x,
    "--hero-photo-y": desktopFocus.y,
    "--hero-photo-x-desktop": desktopFocus.x,
    "--hero-photo-y-desktop": desktopFocus.y,
    "--hero-photo-x-mobile": mobileFocus.x,
    "--hero-photo-y-mobile": mobileFocus.y,
    "--hero-photo-shift-y": "0%",
    "--hero-photo-scale": "1.02",
    "--hero-photo-origin": "center center",
  } as CSSProperties;

  return (
    <>
      {phase === "intro" ? (
        <section
      className={styles.heroFeature}
      data-cw-topbar-tone="dark"
      data-cw-detail-template="dosha"
      data-cw-semantic-role="diagnostic-entry"
      data-cw-semantic-family="guide-progress"
      data-cw-token-source="global-app-ds"
      data-dosha-test="true"
      data-dosha-phase="intro"
      style={heroStyle}
    >
      <div className={styles.heroPhotoLayer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src={doshaHeroArtwork.desktop} alt="Доша-тест CenterWay" />
      </div>
      <div
        className={`${styles.heroFeatureContent} ${styles.diagnosticHeroContent}`}
        style={{
          fontFamily: testFontFamily,
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <article className={`${styles.panel} ${styles.diagnosticHeroCard}`}>
          <div className={styles.panelStack}>
            <div className={styles.panelIntro}>
              <p className={styles.heroBadge}>
                <span>{topbarBadge}</span>
              </p>
              <p className={styles.label}>CenterWay • Діагностика стану</p>
              <h1 className={styles.title}>Тест доші</h1>
              <p className={styles.lead}>
                Швидка самодіагностика ритму, енергії, травлення і напруги, щоб побачити свій поточний стан і зрозуміти
                перший доречний маршрут у платформі.
              </p>
            </div>

            <div className={styles.card} data-tone="proof">
              <p className={styles.label}>Що ви отримаєте</p>
              <ol className={styles.diagnosticNumberList}>
                <li>Короткий профіль доші як робочу гіпотезу для читання свого стану.</li>
                <li>Практичний вектор на найближчі 7 днів без зайвої абстракції.</li>
                <li>Зрозумілий наступний крок: консультація, програма або самостійний старт.</li>
              </ol>
            </div>

            {error ? (
              <p
                className={styles.proofNote}
                style={{
                  color: "var(--cw-danger)",
                  background: "color-mix(in srgb, var(--cw-danger) 8%, var(--cw-platform-surface) 92%)",
                }}
              >
                {error}
              </p>
            ) : null}

            <div className={styles.diagnosticActions}>
              <button
                type="button"
                onClick={() => {
                  void requestStartTest();
                }}
                disabled={isBusy}
                className={styles.heroPrimaryButton}
              >
                {isBusy ? "Запускаємо..." : "Почати тест"}
              </button>

              <button
                type="button"
                onClick={() => setIsDoshaInfoOpen((prev) => !prev)}
                className={styles.heroSecondaryButton}
                aria-expanded={isDoshaInfoOpen}
                aria-controls="what-is-dosha"
              >
                <span>{isDoshaInfoOpen ? "Сховати опис доші" : "Що таке доші?"}</span>
              </button>
            </div>

            {isDoshaInfoOpen ? (
              <div className={styles.card} data-tone="support" id="what-is-dosha">
                <p>У підході CenterWay доші описують природні патерни енергії, ритму й відновлення. Тест допомагає обрати релевантний маршрут практик і контенту в платформі.</p>
              </div>
            ) : null}
          </div>
        </article>
      </div>
        </section>
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
                  {topbarBadge}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--cw-muted)" }}>
                  <span>Питання {currentQuestion.orderIndex} з {totalQuestions}</span>
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

              <div className="space-y-2">
                <h2 className={styles.title}>{currentQuestion.text}</h2>
                <p className={styles.lead}>Оберіть варіант, який найточніше описує ваш поточний стан.</p>
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

              {error ? (
                <p
                  className={styles.proofNote}
                  style={{
                    color: "var(--cw-danger)",
                    background: "color-mix(in srgb, var(--cw-danger) 8%, var(--cw-platform-surface) 92%)",
                  }}
                >
                  {error}
                </p>
              ) : null}

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
          ) : null}

          {phase === "loading" ? (
            <div className="space-y-4 py-10 text-center">
              <div className="flex justify-start">
                <span
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.08em]"
                  style={{
                    borderColor: "var(--cw-border)",
                    background: "color-mix(in srgb, var(--cw-surface-solid) 88%, #ffffff 12%)",
                    color: "var(--cw-text)",
                  }}
                >
                  {topbarBadge}
                </span>
              </div>

              <div
                className="mx-auto h-12 w-12 rounded-full border-4 animate-spin motion-reduce:animate-none"
                style={{ borderColor: "var(--cw-border)", borderTopColor: "var(--cw-status-success)" }}
              />
              <h2 className={styles.title}>Аналізуємо ваш профіль...</h2>
              <p className={styles.lead}>Формуємо практичний вектор і наступний маршрут у платформі.</p>
            </div>
          ) : null}

          {phase === "result" && resultType && resultCopy ? (
            <div className="space-y-6">
              <div className="flex justify-start">
                <span
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.08em]"
                  style={{
                    borderColor: "var(--cw-border)",
                    background: "color-mix(in srgb, var(--cw-surface-solid) 88%, #ffffff 12%)",
                    color: "var(--cw-text)",
                  }}
                >
                  {topbarBadge}
                </span>
              </div>

              <div className={styles.card} data-tone="support">
                <p className={styles.label}>Ваш профіль</p>
                <h2>{resultCopy.title}</h2>
                <p>{resultCopy.summary}</p>
                <p>{resultCopy.recommendation}</p>
              </div>

              <div className={styles.card} data-tone="proof">
                <h2>Що це означає у практиці</h2>
                <p>{resultCopy.weekVector}</p>
                <p>Рахунок: Вата {scores.vata} • Пітта {scores.pitta} • Капха {scores.kapha}</p>
              </div>

              <div className="space-y-3">
                <p className={styles.label}>Наступний крок</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href={DOSHA_PRIMARY_EXIT.href}
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
                    className="cw-btn-primary inline-flex w-full min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold motion-reduce:transition-none"
                  >
                    Отримати персональні рекомендації
                  </Link>
                  <Link
                    href={DOSHA_SECONDARY_EXIT.href}
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
                    className="cw-btn-outline inline-flex w-full min-h-11 items-center justify-center px-4 py-3 text-sm font-semibold motion-reduce:transition-none"
                    style={{ color: "var(--cw-text)" }}
                  >
                    Переглянути програму
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    saveAttemptId(null);
                    setAttemptId(null);
                    setPhase("intro");
                    setResultViewedSent(false);
                  }}
                  className={styles.heroSecondaryButton}
                >
                  <span>Пройти тест ще раз</span>
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </div>
        </section>
      )}

      <PlatformAuthModal
        open={showAuthPrompt && !session?.user && isAuthEnabled}
        onClose={() => setShowAuthPrompt(false)}
        onSignIn={() => {
          void signInWithGoogle();
        }}
      />
    </>
  );
}
