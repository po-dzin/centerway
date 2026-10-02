/* Split out of DoshaTestClient on 2026-09-13. Owns the dosha test's state
   machine: every piece of state, the server calls, the draft and pending-save
   shelves, the analytics events, and every effect — in the order the component
   used to declare them, so effects still run in the same sequence. Returns only
   what the phase views need to render and act. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyDosha, DOSHA_MAX_CHOICES_PER_QUESTION, type DoshaResultType } from "@/lib/dosha/doshaTest";
import { CONFIDENCE_COPY, RESULT_COPY } from "@/lib/dosha/doshaResultCopy";
import { DOSHA_PRIMARY_EXIT } from "@/lib/dosha/doshaRouting";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import { useSession } from "@/components/auth/SessionProvider";
import {
  attachAttempt,
  completeAttempt,
  loadDefinition as fetchDefinition,
  postAttemptEvent,
  requestTelegramLink,
  syncPlatformUser,
  type TestDefinitionResponse,
  type TestQuestion,
} from "./doshaTestApi";
import { keepResult, markResultClaimed, readKeptResult } from "@/lib/tests/keptResult";
import {
  ATTEMPT_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  KEPT_RESULT_KEY,
  SESSION_STORAGE_KEY,
  getOrCreateStoredSessionId,
  removeStoredDraft,
  storeAttemptId,
  storeDraft,
} from "./doshaTestStorage";
import type {
  AttemptEventName,
  AttemptEventPayload,
  CompleteResponse,
  DoshaPhase,
  DraftState,
  PendingSave,
} from "./doshaTestTypes";

/* Left over from the retired screen generator, which offered a palette per
   query parameter. Nothing serves those palettes any more, so the only job
   left is to take the parameters back out of the address bar — a reader who
   follows an old link should not carry a dead switch around with them. */
const THEME_QUERY_KEYS = ["cw_theme", "theme", "palette"] as const;

function getCurrentQuestion(questions: TestQuestion[], currentQuestionIndex: number): TestQuestion | null {
  const idx = Math.max(1, currentQuestionIndex) - 1;
  return questions[idx] ?? null;
}

export function useDoshaAttempt(uiVariant: string) {
  const [phase, setPhase] = useState<DoshaPhase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [resultType, setResultType] = useState<DoshaResultType | null>(null);
  const [scores, setScores] = useState({ vata: 0, pitta: 0, kapha: 0 });
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultViewedSent, setResultViewedSent] = useState(false);
  const { session, status } = useSession();
  const accessToken = session?.access_token ?? null;
  const [savedToCabinet, setSavedToCabinet] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [resumeDraft, setResumeDraft] = useState<DraftState | null>(null);
  /* The cabinet lives on the personal host; only this resolver knows whether
     that is a path or a full origin from where the reader currently stands. */
  const surfaceHref = useSurfaceHref();
  const isAuthEnabled = useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    [],
  );

  const currentQuestion = useMemo(
    () => getCurrentQuestion(questions, currentQuestionIndex),
    [questions, currentQuestionIndex],
  );

  const totalQuestions = questions.length || 12;

  const getOrCreateSessionId = useCallback(() => getOrCreateStoredSessionId(), []);

  const saveAttemptId = useCallback((id: string | null) => storeAttemptId(id), []);

  const clearDraft = useCallback(() => removeStoredDraft(), []);

  const saveDraft = useCallback((draft: DraftState) => storeDraft(draft), []);

  const emitAttemptEvent = useCallback(
    async (eventName: AttemptEventName, payload: AttemptEventPayload = {}) => {
      if (!attemptId) return;

      await postAttemptEvent(attemptId, {
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
        experimentKey: payload.experimentKey ?? null,
        variantKey: payload.variantKey ?? null,
        manifestId: payload.manifestId ?? null,
        manifestVersion: payload.manifestVersion ?? null,
        recipeVersion: payload.recipeVersion ?? null,
        mode: payload.mode ?? null,
        branch: payload.branch ?? null,
        assignmentSource: payload.assignmentSource ?? null,
      });
    },
    [attemptId, phase, uiVariant],
  );

  const loadDefinition = useCallback(
    (): Promise<TestDefinitionResponse | null> => fetchDefinition(getOrCreateSessionId()),
    [getOrCreateSessionId],
  );

  const completeTest = useCallback(
    async (finalAnswers: Record<string, string[]>) => {
      if (questions.length === 0) return;

      if (questions.some((question) => !finalAnswers[question.id]?.length)) {
        setError("Не всі відповіді заповнені. Перевірте питання і завершіть тест.");
        return;
      }

      // One row per mark: a question marked twice goes as two rows.
      const orderedAnswers = questions.flatMap((question) =>
        (finalAnswers[question.id] ?? []).map((optionId) => ({ questionId: question.id, optionId })),
      );

      setIsBusy(true);
      setError(null);
      setPhase("loading");

      try {
        const res = await completeAttempt({ sessionId: getOrCreateSessionId(), answers: orderedAnswers });

        const data = (await res.json()) as CompleteResponse | { error: string };
        if (!res.ok || "error" in data || !data.isCompleted || !data.resultType) {
          setError("Не вдалося завершити тест. Спробуйте ще раз.");
          setPhase("question");
          return;
        }

        /* Kept before it is shown: from here on a reload, a Back from the
           sign-in, or a visit tomorrow brings this result back. Completed
           with a session, it is already the account's. */
        const ownedNow = Boolean(session?.user);
        keepResult<PendingSave>(
          KEPT_RESULT_KEY,
          {
            attemptId: data.attemptId,
            resultType: data.resultType,
            scores: data.scores,
            completedAt: data.completedAt ?? new Date().toISOString(),
            nextStep: data.nextStep ?? DOSHA_PRIMARY_EXIT.nextStep,
          },
          ownedNow,
        );
        setSavedToCabinet(ownedNow);
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
    },
    [clearDraft, getOrCreateSessionId, questions, saveAttemptId, session],
  );

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

  /* Which phase is on screen, for the restore below: it runs on session
     changes, and must not pull a reader out of a retake in progress. */
  const phaseRef = useRef<DoshaPhase>("intro");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* THE RESULT COMES BACK, WHATEVER HAPPENED IN BETWEEN.
     A reload, a Back from the sign-in, a Google round trip, an emailed code
     typed into the gate, a visit hours later: each lands here with the result
     kept in this browser (lib/tests/keptResult). An unfinished retake wins —
     its draft is newer than the result. With a session, the attempt is handed
     to the account first, so the screen opens already saved, or says it is not. */
  const restoreKeptResult = useCallback(async (signedIn: boolean) => {
    if (typeof window === "undefined") return;
    if (phaseRef.current === "question" || phaseRef.current === "loading") return;
    const kept = readKeptResult<PendingSave>(KEPT_RESULT_KEY);
    if (!kept?.result.attemptId || !kept.result.resultType) return;
    try {
      const draft = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "null") as DraftState | null;
      if (draft?.answers && Object.keys(draft.answers).length > 0) return;
    } catch {
      // An unreadable draft is no draft.
    }

    let claimed = kept.claimed;
    if (signedIn && !claimed) {
      const res = await attachAttempt(kept.result.attemptId);
      claimed = Boolean(res?.ok);
      if (claimed) markResultClaimed(KEPT_RESULT_KEY);
    } else {
      await Promise.resolve();
    }

    const { result } = kept;
    setAttemptId(result.attemptId);
    setResultType(result.resultType);
    setScores(result.scores);
    setCompletedAt(result.completedAt);
    setNextStep(result.nextStep);
    setSavedToCabinet(claimed);
    setResultViewedSent(true);
    setPhase("result");
  }, []);

  /* «Не вдалося зберегти» → «Спробувати ще раз». */
  const retrySave = useCallback(async () => {
    const kept = readKeptResult<PendingSave>(KEPT_RESULT_KEY);
    if (!kept?.result.attemptId) return;
    const res = await attachAttempt(kept.result.attemptId);
    if (res?.ok) {
      markResultClaimed(KEPT_RESULT_KEY);
      setSavedToCabinet(true);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    void (async () => {
      await restoreKeptResult(status === "signed-in");
    })();
  }, [status, restoreKeptResult]);

  /* One subscription for the whole tree lives in the root layout's
     SessionProvider; whenever a signed-in session appears or its token
     changes, the account is mirrored into platform_users. */
  useEffect(() => {
    if (status !== "signed-in") return;
    void syncPlatformUser();
  }, [status, accessToken]);

  /* AN UNFINISHED TEST IS PICKED UP, NOT THROWN AWAY.
     This effect used to wipe the draft, the attempt id and the session id on
     every mount — which meant the whole draft machinery below it (`saveDraft`
     on every answer) wrote to a shelf nobody ever read, and eleven answers
     died to a reload or a locked phone. The reminder cron, meanwhile, went on
     chasing the abandoned attempts this created.

     The session id is kept as well as the answers, because it seeds the order
     of the options: restoring answers under a freshly shuffled question would
     hand the reader someone else's choices. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    let draft: DraftState | null = null;
    try {
      draft = raw ? (JSON.parse(raw) as DraftState) : null;
    } catch {
      draft = null;
    }

    const answered = draft?.answers ? Object.keys(draft.answers).length : 0;
    if (!draft?.sessionId || answered === 0) {
      // Nothing to resume: start clean, and do not leave a stale attempt id
      // pointing at a run this page no longer has on screen.
      window.localStorage.removeItem(ATTEMPT_STORAGE_KEY);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setPhase("intro");
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, draft.sessionId);
    setResumeDraft(draft);
  }, []);

  /* The questions come from the server, so the resume is two steps: the effect
     above decides there is something to return to, this one goes and gets the
     material it needs. */
  useEffect(() => {
    if (!resumeDraft) return;
    let cancelled = false;
    setIsBusy(true);

    void loadDefinition()
      .then((data) => {
        if (cancelled) return;
        const loaded = data?.questions ?? [];
        if (!loaded.length) {
          setPhase("intro");
          return;
        }

        // Only answers whose question is still in the definition survive: a
        // test that changed under a draft must not resume half in the old one.
        const valid: Record<string, string[]> = {};
        for (const question of loaded) {
          const saved = resumeDraft.answers[question.id];
          const chosen = (Array.isArray(saved) ? saved : saved ? [saved] : [])
            .filter((id) => question.options.some((option) => option.id === id))
            .slice(0, DOSHA_MAX_CHOICES_PER_QUESTION);
          if (chosen.length) {
            valid[question.id] = chosen;
          }
        }
        if (!Object.keys(valid).length) {
          clearDraft();
          setPhase("intro");
          return;
        }

        setQuestions(loaded);
        setAnswers(valid);
        setCurrentQuestionIndex(Math.min(Math.max(resumeDraft.currentQuestionIndex, 1), loaded.length));
        setPhase("question");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsBusy(false);
          setResumeDraft(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearDraft, loadDefinition, resumeDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    let changed = false;

    for (const key of THEME_QUERY_KEYS) {
      if (!url.searchParams.has(key)) continue;
      url.searchParams.delete(key);
      changed = true;
    }

    if (!changed) return;
    const search = url.searchParams.toString();
    window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  }, []);

  /* Asked for as soon as there is a result, not on the tap: the link is issued
     by the server, and a `window.open` after an awaited fetch is what popup
     blockers exist to stop. By the time the reader reaches for it, it is a
     plain link. */
  const unlocked = !isAuthEnabled || Boolean(session?.user);

  useEffect(() => {
    /* Only past the door: the Telegram button lives in the full reading, and
       issuing a link for a locked screen would mint one nobody can press. */
    if (phase !== "result" || !attemptId || !unlocked) return;
    let cancelled = false;

    void requestTelegramLink(attemptId).then((link) => {
      if (!cancelled) setTelegramLink(link);
    });

    return () => {
      cancelled = true;
    };
  }, [attemptId, phase, unlocked]);

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

  /* NOTHING IS ASKED BEFORE ANYTHING IS GIVEN.
     Starting the test used to open a Google-only sign-in wall in front of
     question one — the price was collected before the value was delivered, on
     the page whose whole job is to be easy to begin. The account is worth
     something only once there is a result to keep, so the offer to sign in now
     lives on the result screen. The API has always accepted anonymous
     attempts: `user_id` is nullable and the session id carries the attempt. */
  const requestStartTest = useCallback(async () => {
    await runStartFlow();
  }, [runStartFlow]);

  /* Choosing and moving on are two acts, and they used to be one: tapping an
     option wrote the answer, advanced the question and locked the choice, so a
     misplaced thumb cost you an answer you could never revisit ("перша версія:
     попередню відповідь змінити не можна"). Selection is now local state and
     nothing else; the step moves when the reader says so, in either direction.
     Nothing reaches the server until the last answer — `completeTest` posts the
     whole set — so going back costs no request and no consistency problem. */
  /* A tap toggles a mark. Up to two marks per question: a third option stays
     unavailable until one is lifted, rather than silently dropping the older
     mark — an answer should never change without the reader touching it. */
  const selectAnswer = useCallback(
    (questionId: string, optionId: string) => {
      if (isBusy) return;

      const current = answers[questionId] ?? [];
      let chosen: string[];
      if (current.includes(optionId)) {
        chosen = current.filter((id) => id !== optionId);
      } else if (current.length < DOSHA_MAX_CHOICES_PER_QUESTION) {
        chosen = [...current, optionId];
      } else {
        return;
      }

      const nextAnswers = { ...answers };
      if (chosen.length) {
        nextAnswers[questionId] = chosen;
      } else {
        delete nextAnswers[questionId];
      }
      setAnswers(nextAnswers);
      setError(null);
      saveDraft({
        answers: nextAnswers,
        currentQuestionIndex,
        sessionId: getOrCreateSessionId(),
        updatedAt: new Date().toISOString(),
      });
    },
    [answers, currentQuestionIndex, getOrCreateSessionId, isBusy, saveDraft],
  );

  const goToStep = useCallback(
    (nextIndex: number) => {
      const bounded = Math.min(Math.max(nextIndex, 1), totalQuestions);
      setCurrentQuestionIndex(bounded);
      setError(null);
      saveDraft({
        answers,
        currentQuestionIndex: bounded,
        sessionId: getOrCreateSessionId(),
        updatedAt: new Date().toISOString(),
      });
    },
    [answers, getOrCreateSessionId, saveDraft, totalQuestions],
  );

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentQuestionIndex >= totalQuestions;
  const currentChoices = currentQuestion ? (answers[currentQuestion.id] ?? []) : [];
  const currentAnswered = currentChoices.length > 0;

  const goForward = useCallback(() => {
    if (!currentQuestion || !answers[currentQuestion.id]?.length) return;
    if (isLastQuestion) {
      void completeTest(answers);
      return;
    }
    goToStep(currentQuestionIndex + 1);
  }, [answers, completeTest, currentQuestion, currentQuestionIndex, goToStep, isLastQuestion]);

  /* The two plain handlers the views used to write inline: back from the first
     question to the description, and "take the test again" from the result. */
  const backToIntro = () => setPhase("intro");

  const restartTest = () => {
    saveAttemptId(null);
    setAttemptId(null);
    setPhase("intro");
    setResultViewedSent(false);
  };

  /* Progress is what is answered, not what is on screen: stepping back through
     finished questions must not walk the bar backwards. */
  const progress = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));
  const resultCopy = resultType ? RESULT_COPY[resultType] : null;

  /* Derived from the same scores the server classified, by the same function —
     so the screen can say how firm the reading is without a second round trip
     and without a field that older stored attempts do not carry. */
  const profile = useMemo(() => classifyDosha(scores.vata, scores.pitta, scores.kapha), [scores]);
  const confidenceCopy = CONFIDENCE_COPY[profile.confidence];
  const resultHeading = resultCopy ? (profile.confidence === "low" ? resultCopy.softTitle : resultCopy.title) : null;
  const topbarBadge =
    phase === "intro"
      ? "12 питань • 3-5 хв"
      : phase === "question"
        ? `Питання ${currentQuestion?.orderIndex ?? currentQuestionIndex} з ${totalQuestions}`
        : phase === "loading"
          ? "Формуємо результат"
          : "Результат готовий";

  return {
    phase,
    attemptId,
    answers,
    resultType,
    scores,
    completedAt,
    nextStep,
    isBusy,
    error,
    hasSessionUser: Boolean(session?.user),
    /* Without auth configured (a bare local checkout) there is no door to
       go through, so the reading is shown whole rather than locked forever. */
    unlocked,
    savedToCabinet,
    telegramLink,
    surfaceHref,
    isAuthEnabled,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    isLastQuestion,
    currentAnswered,
    progress,
    resultCopy,
    profile,
    confidenceCopy,
    resultHeading,
    topbarBadge,
    emitAttemptEvent,
    retrySave,
    requestStartTest,
    selectAnswer,
    goToStep,
    goForward,
    backToIntro,
    restartTest,
  };
}
