"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Course } from "@/lms-core";
import { acknowledgeDurableCourseDraft, writeDurableCourseDraft } from "./courseDraftStore";

const AUTOSAVE_DELAY_MS = 1_500;

export type AutosaveResult =
  | { ok: true; message: string; generation: number }
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
  getDraftGeneration,
}: {
  course: Course | null;
  dirty: boolean;
  paused?: boolean;
  persist: (course: Course) => Promise<AutosaveResult>;
  markSaved: (course: Course) => void;
  getDraftGeneration: () => number | null;
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
  const getDraftGenerationRef = useRef(getDraftGeneration);
  const snapshotIds = useRef(new WeakMap<Course, string>());
  const durableEntries = useRef(new WeakMap<Course, {
    generation: number | null;
    snapshotId: string;
    write: Promise<void>;
  }>());
  const durableChain = useRef(Promise.resolve());
  const writerId = useRef<string | null>(null);
  if (writerId.current === null) writerId.current = crypto.randomUUID();

  useEffect(() => {
    latestCourse.current = course;
    persistRef.current = persist;
    markSavedRef.current = markSaved;
    getDraftGenerationRef.current = getDraftGeneration;
  }, [course, getDraftGeneration, markSaved, persist]);

  const durableIdentity = useCallback((snapshot: Course) => {
    const existing = snapshotIds.current.get(snapshot);
    if (existing) return existing;
    const created = crypto.randomUUID();
    snapshotIds.current.set(snapshot, created);
    return created;
  }, []);

  const preserveLocally = useCallback((snapshot: Course) => {
    const existing = durableEntries.current.get(snapshot);
    if (existing) return existing;
    const generation = getDraftGenerationRef.current();
    const snapshotId = durableIdentity(snapshot);
    const write = generation === null
      ? Promise.resolve()
      : durableChain.current.then(() => writeDurableCourseDraft({
          courseId: snapshot.id,
          course: snapshot,
          baseGeneration: generation,
          snapshotId,
          writerId: writerId.current!,
          updatedAt: Date.now(),
        })).catch(() => undefined);
    durableChain.current = write;
    const entry = {
      generation,
      snapshotId,
      write,
    };
    durableEntries.current.set(snapshot, entry);
    return entry;
  }, [durableIdentity]);

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

    const durable = preserveLocally(snapshot);
    const request = chain.current.then(async () => {
      await durable.write;
      const result = await persistRef.current(snapshot).catch((): AutosaveResult => ({
        ok: false,
        message: "Не вдалося зберегти. Спробуйте ще раз.",
      }));
      if (result.ok) {
        markSavedRef.current(snapshot);
        if (durable.generation !== null) {
          durableChain.current = durableChain.current.then(() => acknowledgeDurableCourseDraft({
              courseId: snapshot.id,
              writerId: writerId.current!,
              snapshotId: durable.snapshotId,
              previousGeneration: durable.generation!,
              nextGeneration: result.generation,
            })).catch(() => undefined);
        }
      }
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
  }, [preserveLocally]);

  useEffect(() => {
    if (!course || !dirty) return;
    void preserveLocally(course).write;
  }, [course, dirty, preserveLocally]);

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
