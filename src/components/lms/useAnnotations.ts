"use client";

/**
 * The reader's marks for one course, held for the whole visit.
 *
 * COURSE-WIDE, NOT PER LESSON. The course page lists every bookmark and note in
 * one place, and the pager walks between lessons without a reload; one fetch
 * per course means neither of those pays for a round trip, and a mark made in a
 * lesson is already in the list by the time the reader gets back to it.
 *
 * Optimistic on every write, like the checklist: marking a passage must answer
 * the finger, not the network. A rejected write rolls back to exactly what the
 * server last confirmed rather than to a guess.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Annotation, AnnotationAnchor } from "@/lms-core";
import {
  annotationClientId,
  deleteAnnotation as deleteRemote,
  fetchAnnotations,
  saveAnnotation as saveRemote,
} from "./lmsClient";

/**
 * The lesson's own bookmark, if any — found by WHAT it is, not by what this
 * device happened to name it.
 *
 * A deterministic `bookmark:<lessonSlug>` clientId looked like the simpler
 * rule, and it is wrong the moment a second device is in the picture: a
 * bookmark made on a phone gets a real clientId from `annotationClientId()`,
 * this device's fetch returns it under that id, and a lookup keyed on the
 * guessed id never finds it. The star then reads as unmarked forever, and
 * pressing it tries to CREATE a second bookmark for a lesson that already has
 * one — which the server's one-bookmark-per-enrollment-and-lesson index
 * refuses, so the press just fails. `kind` and `lessonSlug` are the only two
 * facts that are actually true of a bookmark; nothing else needs guessing.
 */
function findBookmark(all: Annotation[], lessonSlug: string): Annotation | undefined {
  return all.find((item) => item.kind === "bookmark" && item.lessonSlug === lessonSlug);
}

export type AnnotationsState = {
  all: Annotation[];
  /** This lesson's marks, in the order they were made. */
  forLesson: (lessonSlug: string) => Annotation[];
  bookmarked: (lessonSlug: string) => boolean;
  toggleBookmark: (lessonSlug: string) => Promise<void>;
  /** Adds a highlight (with an optional note) and returns its client id. */
  mark: (lessonSlug: string, anchor: AnnotationAnchor, note?: string | null) => Promise<string | null>;
  setNote: (clientId: string, note: string | null) => Promise<void>;
  remove: (clientId: string) => Promise<void>;
  ready: boolean;
};

export function useAnnotations(courseSlug: string, enabled: boolean): AnnotationsState {
  const [all, setAll] = useState<Annotation[]>([]);
  /* A surface that keeps no marks — the builder's draft preview — is ready
     immediately and never asks. Expressed as the initial value rather than as
     an effect that sets it: an effect writing state it could have been born
     with is a render the reader pays for. */
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchAnnotations(courseSlug);
      if (cancelled) return;
      // A failed read leaves the reader with no marks drawn rather than an
      // error page: the lesson is still readable, and the next navigation
      // retries. Losing a mark, on the other hand, is never silent — writes
      // roll back visibly.
      setAll(result.ok ? result.data.annotations : []);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, enabled]);

  const write = useCallback(
    async (next: Annotation, previous: Annotation[]) => {
      const result = await saveRemote(courseSlug, {
        clientId: next.clientId,
        kind: next.kind,
        lessonSlug: next.lessonSlug,
        anchor: next.anchor,
        note: next.note,
      });
      if (!result.ok) {
        setAll(previous);
        return false;
      }
      // The server's row wins: it carries the real timestamps and the clamped
      // text, so a note typed longer than the cap does not keep its tail here.
      setAll((current) =>
        current.map((item) => (item.clientId === next.clientId ? result.data.annotation : item))
      );
      return true;
    },
    [courseSlug]
  );

  const toggleBookmark = useCallback(
    async (lessonSlug: string) => {
      const previous = all;
      const existing = findBookmark(all, lessonSlug);

      if (existing) {
        const existingId = existing.clientId;
        setAll((current) => current.filter((item) => item.clientId !== existingId));
        const result = await deleteRemote(courseSlug, existingId);
        if (!result.ok) setAll(previous);
        return;
      }

      const now = new Date().toISOString();
      const next: Annotation = {
        clientId: annotationClientId(),
        kind: "bookmark",
        lessonSlug,
        anchor: null,
        note: null,
        courseVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      setAll((current) => [...current, next]);
      await write(next, previous);
    },
    [all, courseSlug, write]
  );

  const mark = useCallback(
    async (lessonSlug: string, anchor: AnnotationAnchor, note: string | null = null) => {
      const previous = all;
      const now = new Date().toISOString();
      const next: Annotation = {
        clientId: annotationClientId(),
        kind: "highlight",
        lessonSlug,
        anchor,
        note,
        courseVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      setAll((current) => [...current, next]);
      const saved = await write(next, previous);
      return saved ? next.clientId : null;
    },
    [all, write]
  );

  const setNote = useCallback(
    async (clientId: string, note: string | null) => {
      const previous = all;
      const existing = all.find((item) => item.clientId === clientId);
      if (!existing) return;
      const next = { ...existing, note: note && note.trim() ? note : null };
      setAll((current) => current.map((item) => (item.clientId === clientId ? next : item)));
      await write(next, previous);
    },
    [all, write]
  );

  const remove = useCallback(
    async (clientId: string) => {
      const previous = all;
      setAll((current) => current.filter((item) => item.clientId !== clientId));
      const result = await deleteRemote(courseSlug, clientId);
      if (!result.ok) setAll(previous);
    },
    [all, courseSlug]
  );

  return useMemo(
    () => ({
      all,
      forLesson: (lessonSlug: string) => all.filter((item) => item.lessonSlug === lessonSlug),
      bookmarked: (lessonSlug: string) => findBookmark(all, lessonSlug) !== undefined,
      toggleBookmark,
      mark,
      setNote,
      remove,
      ready,
    }),
    [all, mark, ready, remove, setNote, toggleBookmark]
  );
}
