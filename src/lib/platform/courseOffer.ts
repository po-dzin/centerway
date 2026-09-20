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

import { coverArtworkFraming } from "@/lib/lms/courseCover";
import type { OfferSurface } from "@/lib/platform/offerSurface";
import { plural } from "@/lib/plural";
import { offerName, offerSubtitle } from "@/lib/platform/offerPreview";
import { COURSE_KIND_BADGES } from "@/lib/platform/catalogVocabulary";
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
  course: { badge: COURSE_KIND_BADGES.course, surface: "program" },
  mini: { badge: COURSE_KIND_BADGES.mini, surface: "mini-course" },
  checklist: { badge: COURSE_KIND_BADGES.checklist, surface: "mini-course" },
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
    /* THE ADDRESS, NOT THE IDENTITY. A course is stored under `slug` and SOLD
       under `programSlug` — «Short-Перезавантаження» is the course `short` and
       the offer `/programs/reboot`, and the shelf entry a buyer already owns
       carries the program slug for exactly that join (see OfferAccess). While
       every dynamic offer happened to have the two strings equal this read as
       the same thing; it stopped being the same thing the moment the last two
       hand-written pages moved here. */
    slug: course.programSlug,
    /* THE NAME, NOT THE NAME PLUS ITS EXPLANATION. A course out of the builder
       has one title field, and an author with two things to say writes them
       both into it: «Розвантажувальний день — практикум з умовного
       голодування» came out as a four-line hero and an unreadable card. The
       tail is not lost — the tagline below says it in a sentence — and this is
       a display rule, not an edit: `course.title` in the database is untouched
       and still what the page's metadata and its schema.org name print.

       UNCONDITIONAL: the spaced-dash tail remains a legacy subtitle, not part
       of a compact card title. A course written before the split has one
       string with two jobs, and the reader must still see both without the
       card becoming a paragraph.
       A name whose dash is genuinely part of it (no course does this today —
       see courseOffer.test.ts) is a real gap in this rule, but fixing it needs
       a way to tell "trailing explanation" from "the name itself" that the
       data does not carry yet; skipping the cut would silently restore the
       four-line hero for every course written before the split.

       `fullTitle` NO LONGER IS the same string (2026-09-11). It was, on the
       argument that a builder course carries one name and inventing a longer
       one for the hero would print the very line this rule removes. Read on a
       real page that argument loses: the author writes a whole title, the
       offer page is the one surface with room for it, and it was the surface
       showing the least. So the split is now what it says on the type — `title`
       is the short name a card, a crumb and a button carry, `fullTitle` is the
       author's line as written, and the hero prints it whole. The four-line
       hero this rule was written against is back as a possibility; it is now a
       typographic decision the author can see and shorten, rather than a
       sentence the system silently removed from their page. */
    title: offerName(course.title),
    fullTitle: course.title,
    /* The legacy title tail remains a subtitle on the page. The hero drops it
       when its own title already ends in it — see ProgramDetailPage — so
       nothing says the tail twice. */
    /* The author's line above the name, carried as written. No fallback and no
       parse: unlike `subtitle`, this was never inferred from anything — an
       author either wrote a надзаголовок or did not, and a page that has none
       prints none. */
    ...(course.pretitle ? { pretitle: course.pretitle } : {}),
    ...(offerSubtitle(course.title) ? { subtitle: offerSubtitle(course.title) } : {}),
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
            ...coverArtworkFraming(course.cover),
          },
        }
      : {}),
  };
}
