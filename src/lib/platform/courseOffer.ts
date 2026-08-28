/**
 * A course, seen as an offer.
 *
 * WHY IT LEFT THE ROUTE. This was written inside `/programs/[slug]`, where it
 * served courses that exist only in the database. Then the six hand-written
 * pages needed the same thing: `/programs/reset-day` was printing an offer out
 * of `content.ts` literals while the course delivering it — the one the author
 * edits in the builder — sat in the database saying it better. Two functions
 * turning a course into an offer would have been two answers to "how long is
 * this", and they would have disagreed within a week.
 *
 * Every field has a home on the course already; the author fills them in the
 * builder's «Вітрина» panel. What is missing falls back to something TRUE
 * rather than to a placeholder: a course with no tagline gets the word for what
 * it is, not "Tagline".
 */

import type { OfferSurface } from "@/components/platform/ProgramDetailPage";
import { plural } from "@/lib/plural";
import { offerName, offerSubtitle } from "@/lib/platform/offerPreview";
import { inlineToPlainText, type Course, type CourseKind } from "@/lms-core";

/**
 * What each kind is CALLED on a card, and what shape of offer page it gets.
 *
 * Two different questions with one answer each, kept in one table so they
 * cannot drift: the badge is what a buyer reads, `surface` is which of the two
 * offer-page layouts the template picks. A checklist is a short thing to buy
 * and reads best in the short layout, so it shares `mini-course` there while
 * keeping its own word on the card.
 */
const KIND: Record<CourseKind, { badge: string; surface: "mini-course" | "program" }> = {
  course: { badge: "Курс", surface: "program" },
  mini: { badge: "Міні-курс", surface: "mini-course" },
  checklist: { badge: "Чек-лист", surface: "mini-course" },
};

export function toOfferSurface(course: Course): OfferSurface {
  const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const summary = course.summary ? inlineToPlainText(course.summary) : "";
  /* THE AUTHOR'S ANSWER FIRST, the guess only when they have not given one.
     `lessons <= 8` was the whole definition of "is this a small thing" until
     `kind` existed, and it is a guess dressed as a fact — a twelve-item
     checklist and a six-lesson course are the same number to a counter and
     different products to a buyer. It stays as the fallback rather than being
     deleted: every course written before the field existed still has to render,
     and it rendered from this. */
  const kind = course.kind ? KIND[course.kind] : null;
  const isMini = kind ? kind.surface === "mini-course" : lessons <= 8;
  const en = course.locale === "en";

  return {
    slug: course.slug,
    /* THE NAME, NOT THE NAME PLUS ITS EXPLANATION. A course out of the builder
       has one title field, and an author with two things to say writes them
       both into it: «Розвантажувальний день — практикум з умовного
       голодування» came out as a four-line hero and an unreadable card. The
       tail is not lost — the tagline below says it in a sentence — and this is
       a display rule, not an edit: `course.title` in the database is untouched
       and still what the page's metadata and its schema.org name print.

       UNCONDITIONAL, even once `posttitle` exists — see the subtitle test
       below ("the title is still cut for the name"). `posttitle` answers
       WHERE THE SUBTITLE COMES FROM, not whether the h1 keeps a legacy tail:
       a course written before the field existed still has one string with two
       jobs in it, and an author who has since filled `posttitle` has not
       necessarily rewritten `title` to drop what `posttitle` now says better.
       A name whose dash is genuinely part of it (no course does this today —
       see courseOffer.test.ts) is a real gap in this rule, but fixing it needs
       a way to tell "trailing explanation" from "the name itself" that the
       data does not carry yet; skipping the cut whenever `posttitle` is set
       would silently restore the four-line hero for every course written
       before the field did.

       `fullTitle` is the same string on purpose. The six hand-written offers
       genuinely carry two names (see content.ts); a builder course carries one,
       and inventing a longer one for the hero would print the very line this
       rule exists to remove. */
    title: offerName(course.title),
    fullTitle: offerName(course.title),
    /* Where the tail went, and the field that replaced the guess. The dash-split
       of the title is what this had to infer before `posttitle` existed; the
       author's own line wins, and the parse stays for courses written that way. */
    ...(course.posttitle || offerSubtitle(course.title)
      ? { subtitle: course.posttitle ?? offerSubtitle(course.title) }
      : {}),
    /* THE CATEGORY, never the tagline. This used to read `course.tagline ??
       category`, which conflated two fields with different jobs: `tag` answers
       "what kind of thing is this" and is set in a small uppercase pill beside
       the duration, while `tagline` answers "why would I" and is a sentence.
       Reset Day's — «Вийти з кола «стрес → їжа → провина» за три дні» — came
       out as a paragraph in capitals across the top of the hero. The tagline is
       not lost: it leads, below. */
    tag: kind ? kind.badge : isMini ? "Міні-курс" : "Програма",
    /* THE GRAMMAR LIVES HERE, not in the author's field. `durationDays` is the
       number 3; «3 дні» is one locale's way of saying it, and an `en` course
       says "3 days" — same number, its own noun. That is the whole reason the
       field stopped being prose. The count stays as the fallback for a course
       whose author has not said how long it takes. */
    duration:
      course.durationDays !== undefined
        ? en
          ? `${course.durationDays} ${course.durationDays === 1 ? "day" : "days"}`
          : `${course.durationDays} ${plural(course.durationDays, "день", "дні", "днів")}`
        : course.schedule.mode === "daily"
          ? en
            ? `${lessons} ${lessons === 1 ? "day" : "days"}`
            : `${lessons} ${plural(lessons, "день", "дні", "днів")}`
          : en
            ? `${lessons} ${lessons === 1 ? "lesson" : "lessons"}`
            : `${lessons} ${plural(lessons, "урок", "уроки", "уроків")}`,
    /* The hook leads, the description explains. `summary` says what the course
       IS, which is the right answer to a question somebody has already decided
       to ask; the tagline says why they would ask it. The hero gets the hook
       when the author wrote one, and the summary stays underneath it in the
       method panel. */
    description: course.tagline ?? summary,
    longDescription: summary,
    results: course.results ?? [],
    surfaceType: kind ? kind.surface : isMini ? "mini-course" : "program",
    ...(course.audience ? { audience: course.audience } : {}),
    ...(course.format ? { format: course.format } : {}),
    ...(course.accessNote ? { accessNote: course.accessNote } : {}),
    ...(course.authorNote ? { authorNote: course.authorNote } : {}),
    ...(course.cover
      ? {
          artwork: {
            desktop: course.cover.src,
            ...(course.cover.mobileSrc ? { mobile: course.cover.mobileSrc } : {}),
            desktopPosition: `${course.cover.cropX ?? 50}% ${course.cover.cropY ?? 50}%`,
            mobilePosition: `${course.cover.mobileCropX ?? course.cover.cropX ?? 50}% ${course.cover.mobileCropY ?? course.cover.cropY ?? 50}%`,
            ...(course.cover.wideCropY !== undefined
              ? { widePosition: `${course.cover.cropX ?? 50}% ${course.cover.wideCropY}%` }
              : {}),
          },
        }
      : {}),
  };
}
