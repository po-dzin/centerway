"use client";

/**
 * Whether the person reading this offer page already owns what it sells.
 *
 * WHY A PROVIDER AND NOT A PROP. The offer page is a server component and is
 * statically prerendered — that is what makes a marketing page fast and
 * indexable, and it is not negotiable. But access is per-visitor and cannot be
 * known at build time. So the page ships one HTML for everybody, and this
 * hydrates the two places that must change: the hero and the course outline.
 *
 * WHY ONE PROVIDER AND NOT TWO FETCHES. The hero needs the standing, the
 * outline needs which lessons are done. Before this existed the only access
 * reader on the page was `OwnedCourseNotice`, which fetched the shelf for
 * itself; a second reader in the outline would have been a second request for
 * the same answer, and the two could disagree mid-render.
 *
 * THE ORDER OF STATES MATTERS. `unknown` is not `none`. A page that renders the
 * locked outline while the answer is still in flight shows a paying learner
 * their own course behind padlocks for as long as the request takes — so
 * `unknown` renders exactly what an anonymous visitor sees, and nothing moves
 * until the answer is real.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  fetchCourse,
  fetchMyCourses,
  type CourseOutlineEntryDto,
  type LearnerShelfCourseDto,
} from "@/components/lms/lmsClient";

export type OfferAccess =
  | { state: "unknown" }
  /** Answered, and this visitor does not own it — signed out, or signed in without it. */
  | { state: "none" }
  | {
      state: "owned";
      shelf: LearnerShelfCourseDto;
      /**
       * Per-lesson completion, when the second read has landed.
       *
       * Null while it is in flight or if it failed: the outline then unlocks
       * without ticks rather than waiting. Knowing the course is owned is what
       * removes the padlocks; knowing which lessons are done only decorates
       * them, and decoration must not gate access.
       */
      outline: CourseOutlineEntryDto[] | null;
    };

const OfferAccessContext = createContext<OfferAccess>({ state: "unknown" });

export function useOfferAccess(): OfferAccess {
  return useContext(OfferAccessContext);
}

/**
 * `programSlug`, not the course slug. An offer page is addressed by the program
 * it sells, and the shelf entry carries `programSlug` for exactly this join —
 * the course delivering it may be slugged differently.
 */
export function OfferAccessProvider({
  programSlug,
  children,
}: {
  programSlug: string;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<OfferAccess>({ state: "unknown" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const shelf = await fetchMyCourses();
      if (cancelled) return;

      // A FAILED READ STAYS `unknown`, never `none`. "We could not ask" and
      // "you do not own this" produce different pages, and only one of them is
      // safe to show to somebody who paid.
      if (!shelf.ok) return;

      const match = shelf.data.courses.find(
        (course) => course.programSlug === programSlug && course.access !== "locked"
      );
      if (!match) {
        setAccess({ state: "none" });
        return;
      }

      setAccess({ state: "owned", shelf: match, outline: null });

      // The second read, for the ticks. Deliberately after the first commit:
      // the padlocks come off as soon as ownership is known, rather than when
      // the whole course map has arrived.
      const view = await fetchCourse(match.slug);
      if (cancelled || !view.ok) return;
      setAccess({ state: "owned", shelf: match, outline: view.data.outline });
    })();

    return () => {
      cancelled = true;
    };
  }, [programSlug]);

  return <OfferAccessContext.Provider value={access}>{children}</OfferAccessContext.Provider>;
}
