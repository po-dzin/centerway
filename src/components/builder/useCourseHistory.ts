"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Course } from "@/lms-core";

/**
 * Undo for the builder.
 *
 * WHY THE HOOK OWNS THE COURSE. Both editing screens already held the whole
 * course in one immutable value and replaced it wholesale on every edit
 * (`writePath` returns a new tree, sharing everything it did not touch). That
 * is exactly the shape undo wants, so undo is not a new mechanism here — it is
 * keeping the values that were already being thrown away. The hook owns the
 * working copy so there is one place that can say what "the previous state"
 * means; a component that kept its own copy alongside would have two, and they
 * would disagree the first time an edit landed during an undo.
 *
 * WHY COALESCING. Every keystroke in a title field is an edit, and a stack with
 * one entry per keystroke makes undo useless: the author presses it expecting
 * to lose a word and loses a letter. Consecutive edits carrying the same key
 * within {@link COALESCE_MS} collapse into one entry, so a typing burst is one
 * undo and moving to another field starts a new one. Structural edits — add,
 * delete, reorder — pass a null key and never merge: each one is a deliberate
 * act the author should be able to take back on its own.
 *
 * WHAT IT DOES NOT DO. It does not persist. A reload still loses unsaved work,
 * and `beforeunload` is still what stands between the author and that. Undo is
 * a within-session rope, and it exists before autosave on purpose: autosave
 * without undo turns every mistake into a stored one.
 */

/** Entries kept. Beyond this the oldest are dropped — a bounded rope, not a log. */
const LIMIT = 100;

/** How long a run of same-key edits stays one entry. */
const COALESCE_MS = 700;

/**
 * The stack, split out from the hook so it can be tested.
 *
 * These three functions hold every rule undo has — what merges, what branches,
 * what falls off the end — and none of them touch React. The hook is the part
 * that decides WHEN to merge; this is the part that says what merging means.
 */
export type History = {
  past: Course[];
  present: Course | null;
  future: Course[];
  /** The course as of the last load or save — what `dirty` is measured against. */
  saved: Course | null;
};

export const EMPTY_HISTORY: History = { past: [], present: null, future: [], saved: null };

/** Records `course` as the new present. `merge` replaces the top entry instead of adding one. */
export function pushEdit(history: History, course: Course, merge: boolean): History {
  if (!history.present) return history;
  // Identity, not deep equality: every real edit rebuilds the path it touched,
  // so a value that came back unchanged changed nothing.
  if (course === history.present) return history;
  return {
    ...history,
    past: merge ? history.past : [...history.past, history.present].slice(-LIMIT),
    present: course,
    // Redoing after a new edit would replay a branch the author has left.
    future: [],
  };
}

export function undoStep(history: History): History {
  const previous = history.past.at(-1);
  if (!previous || !history.present) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, LIMIT),
  };
}

export function redoStep(history: History): History {
  const [next, ...rest] = history.future;
  if (!next || !history.present) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: rest,
  };
}

export type CourseHistory = {
  /** The working copy, or null before the course has loaded. */
  course: Course | null;
  /** Loaded or reloaded from the server: the stack starts over and nothing is dirty. */
  reset: (course: Course) => void;
  /**
   * Applies an edit and records the state it replaced.
   *
   * `key` names the thing being edited — a field path, typically — and is what
   * consecutive edits are coalesced by. Pass null for anything structural.
   */
  edit: (key: string | null, next: (course: Course) => Course) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** True when the working copy differs from the last saved one. */
  dirty: boolean;
  /**
   * Declares the working copy clean without touching the stack.
   *
   * Two callers: a successful save, and «піти без збереження» — which disarms
   * the unsaved-changes guard on the way out rather than pretending the edits
   * were written.
   */
  markClean: () => void;
};

export function useCourseHistory(): CourseHistory {
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);

  // Coalescing state is read and written in event handlers, never inside the
  // updater: an updater that mutates a ref runs twice under StrictMode and
  // would decide "merge" off its own first pass.
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);

  const reset = useCallback((course: Course) => {
    lastKey.current = null;
    setHistory({ past: [], present: course, future: [], saved: course });
  }, []);

  const edit = useCallback((key: string | null, next: (course: Course) => Course) => {
    const now = Date.now();
    const merge = key !== null && key === lastKey.current && now - lastAt.current < COALESCE_MS;
    lastKey.current = key;
    lastAt.current = now;

    setHistory((current) => (current.present ? pushEdit(current, next(current.present), merge) : current));
  }, []);

  const undo = useCallback(() => {
    lastKey.current = null;
    setHistory(undoStep);
  }, []);

  const redo = useCallback(() => {
    lastKey.current = null;
    setHistory(redoStep);
  }, []);

  const markClean = useCallback(() => {
    setHistory((current) => ({ ...current, saved: current.present }));
  }, []);

  /**
   * The keyboard.
   *
   * Bound on the window and preventing the default even inside inputs. The
   * browser's own undo is not an alternative here: every field in the builder
   * is controlled by this state, so a native undo rewrites the DOM and the very
   * next render puts it back. Leaving it unbound would give the author a
   * shortcut that visibly does nothing.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return {
    course: history.present,
    reset,
    edit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dirty: history.present !== null && history.present !== history.saved,
    markClean,
  };
}
