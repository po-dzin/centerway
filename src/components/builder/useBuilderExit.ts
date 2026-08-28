"use client";

/**
 * The two ways out of a course, and the difference between them.
 *
 * MOVING INSIDE THE COURSE IS NOT LEAVING. Opening a lesson, coming back to
 * the structure, previewing as a learner — those are one continuous act of
 * editing, and interrupting each with a question about saving would put a
 * dialogue between the author and every second click. They keep the original
 * behaviour: flush the queue, then route.
 *
 * LEAVING THE COURSE ASKS. The shelf, the platform, an account menu — past
 * that boundary the editor is gone, and with it the strip that would otherwise
 * be the only place a refused save is reported. `route` decides which of the
 * two a destination is; a caller that already knows (preview) can name one.
 *
 * THE PROMPT PAUSES AUTOSAVE at the call site (`paused: … || exit.prompt`).
 * It has to: the debounce is 1.5s, a question takes longer than that to read,
 * and a timer that fires behind the dialogue would save the very changes the
 * author is being asked about.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { clearDurableCourseDraft } from "./courseDraftStore";

/** `/build/<this course>/…` — the editor's own territory, at any depth. */
export function staysInCourse(href: string, slug: string): boolean {
  const [path] = href.split(/[?#]/);
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "build" || segments.length < 2) return false;
  return decodeURIComponent(segments[1]) === slug;
}

export type BuilderExitPromptState = {
  href: string;
  saving: boolean;
  /** A save was attempted from the dialogue and came back refused. */
  refused: boolean;
};

export function useBuilderExit({
  slug,
  courseId,
  dirty,
  save,
}: {
  slug: string;
  courseId: string | null;
  dirty: boolean;
  save: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<BuilderExitPromptState | null>(null);

  /** Save first, then go — the in-course move, unchanged. */
  const navigate = useCallback(
    (href: string) => {
      if (!dirty) return router.push(href);
      if (pendingHref || prompt) return;
      setPendingHref(href);
      void save().then((saved) => {
        if (saved) router.push(href);
        else setPendingHref(null);
      });
    },
    [dirty, pendingHref, prompt, router, save]
  );

  /** Ask before crossing the course boundary; move freely inside it. */
  const route = useCallback(
    (href: string) => {
      if (staysInCourse(href, slug)) return navigate(href);
      if (!dirty) return router.push(href);
      if (pendingHref || prompt) return;
      setPrompt({ href, saving: false, refused: false });
    },
    [dirty, navigate, pendingHref, prompt, router, slug]
  );

  const saveAndLeave = useCallback(() => {
    setPrompt((current) => (current ? { ...current, saving: true, refused: false } : current));
    void save().then((saved) => {
      setPrompt((current) => {
        if (!current) return current;
        if (saved) {
          router.push(current.href);
          return current;
        }
        return { ...current, saving: false, refused: true };
      });
    });
  }, [router, save]);

  /**
   * The author said «без збереження», so the device forgets too.
   *
   * Routing is not awaited on the delete: the record is this tab's own, the
   * next visit reads it before it offers anything, and holding the exit on an
   * IndexedDB transaction would make the slowest possible answer the one that
   * feels broken.
   */
  const leaveWithoutSaving = useCallback(() => {
    const target = prompt?.href;
    if (!target) return;
    if (courseId) void clearDurableCourseDraft(courseId).catch(() => undefined);
    setPrompt(null);
    router.push(target);
  }, [courseId, prompt, router]);

  const stay = useCallback(() => {
    setPrompt((current) => (current?.saving ? current : null));
  }, []);

  return { pendingHref, prompt, navigate, route, saveAndLeave, leaveWithoutSaving, stay };
}
