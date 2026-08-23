"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Course } from "@/lms-core";

const AUTOSAVE_DELAY_MS = 1_500;

export type AutosaveResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

type AutosaveState = "idle" | "waiting" | "saving" | "saved" | "error";

/**
 * Debounced, serial persistence for the two Builder document surfaces.
 *
 * Every request carries one immutable Course snapshot. Successful writes mark
 * that exact object as saved, rather than whichever value happens to be on
 * screen when the request returns. Therefore typing during a slow request
 * remains dirty and is queued as a later save instead of being falsely marked
 * clean. The promise chain also prevents two whole-course PUTs from racing.
 */
export function useCourseAutosave({
  course,
  dirty,
  paused = false,
  persist,
  markSaved,
}: {
  course: Course | null;
  dirty: boolean;
  paused?: boolean;
  persist: (course: Course) => Promise<AutosaveResult>;
  markSaved: (course: Course) => void;
}) {
  const [state, setState] = useState<AutosaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [resultSnapshot, setResultSnapshot] = useState<Course | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef(Promise.resolve(true));
  const queued = useRef(new WeakMap<Course, Promise<boolean>>());
  const mounted = useRef(true);
  const pending = useRef(0);
  const latestCourse = useRef(course);
  const persistRef = useRef(persist);
  const markSavedRef = useRef(markSaved);

  useEffect(() => {
    latestCourse.current = course;
    persistRef.current = persist;
    markSavedRef.current = markSaved;
  }, [course, markSaved, persist]);

  useEffect(() => {
    // Strict Mode intentionally runs setup → cleanup → setup in development.
    // Restore the flag in setup so that rehearsal does not disable autosave.
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const enqueue = useCallback((snapshot: Course): Promise<boolean> => {
    const existing = queued.current.get(snapshot);
    if (existing) return existing;

    pending.current += 1;
    if (mounted.current) {
      setState("saving");
      setMessage("Зберігаємо зміни…");
    }

    const request = chain.current.then(async () => {
      const result = await persistRef.current(snapshot).catch((): AutosaveResult => ({
        ok: false,
        message: "Не вдалося зберегти. Спробуйте ще раз.",
      }));
      if (result.ok) markSavedRef.current(snapshot);
      return result;
    }).then((result) => {
      pending.current -= 1;
      queued.current.delete(snapshot);
      if (mounted.current && pending.current === 0) {
        setResultSnapshot(snapshot);
        setState(result.ok ? "saved" : "error");
        setMessage(result.message);
      }
      return result.ok;
    });

    chain.current = request;
    queued.current.set(snapshot, request);
    return request;
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;

    if (!course || !dirty || paused) return;

    timer.current = setTimeout(() => {
      timer.current = null;
      void enqueue(course);
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [course, dirty, enqueue, paused]);

  const saveNow = useCallback((): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return latestCourse.current ? enqueue(latestCourse.current) : Promise.resolve(false);
  }, [enqueue]);

  useEffect(() => {
    if (!dirty) return;
    const flush = () => {
      void saveNow();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };

    // No beforeunload prompt: hiding, switching apps, reloading or closing the
    // page asks the same serial snapshot queue to flush and lets the browser go.
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [dirty, saveNow]);

  const waiting = Boolean(
    course && dirty && !paused && state !== "saving" && !(state === "error" && resultSnapshot === course)
  );

  return {
    state: waiting ? "waiting" as const : state,
    message: waiting ? "Зміни збережуться автоматично" : message,
    saving: state === "saving",
    saveNow,
  };
}
