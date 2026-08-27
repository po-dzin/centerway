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
import { offerName, offerSubtitle } from "@/lib/platform/offerPreview";
import { inlineToPlainText, type Course } from "@/lms-core";

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function toOfferSurface(course: Course): OfferSurface {
  const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const summary = course.summary ? inlineToPlainText(course.summary) : "";
  // The same threshold the catalogue's two rails use. A course is a "mini" one
  // by how much of someone's life it asks for, and lesson count is the only
  // honest proxy the data actually carries.
  const isMini = lessons <= 8;

  return {
    slug: course.slug,
    /* THE NAME, NOT THE NAME PLUS ITS EXPLANATION. A course out of the builder
       has one title field, and an author with two things to say writes them
       both into it: «Розвантажувальний день — практикум з умовного
       голодування» came out as a four-line hero and an unreadable card. The
       tail is not lost — the tagline below says it in a sentence — and this is
       a display rule, not an edit: `course.title` in the database is untouched
       and still what the page's metadata and its schema.org name print.

       `fullTitle` is the same string on purpose. The six hand-written offers
       genuinely carry two names (see content.ts); a builder course carries one,
       and inventing a longer one for the hero would print the very line this
       rule exists to remove. */
    title: offerName(course.title),
    fullTitle: offerName(course.title),
    /* Where the tail went. Cutting the title at the dash removed a claim the
       author wrote on purpose, so the page prints it — once, as a subtitle,
       instead of as half of an unreadable h1. */
    ...(offerSubtitle(course.title) ? { subtitle: offerSubtitle(course.title) } : {}),
    /* THE CATEGORY, never the tagline. This used to read `course.tagline ??
       category`, which conflated two fields with different jobs: `tag` answers
       "what kind of thing is this" and is set in a small uppercase pill beside
       the duration, while `tagline` answers "why would I" and is a sentence.
       Reset Day's — «Вийти з кола «стрес → їжа → провина» за три дні» — came
       out as a paragraph in capitals across the top of the hero. The tagline is
       not lost: it leads, below. */
    tag: isMini ? "Міні-курс" : "Програма",
    /* THE AUTHOR'S WORD WINS. The derived count is true and answers a question
       nobody asked: reset-day is six lessons meant to be walked over three
       days, and «6 уроків» is not what its buyer needs to read. The count stays
       as the fallback for a course whose author has not said. */
    duration:
      course.duration ??
      (course.schedule.mode === "daily"
        ? `${lessons} ${plural(lessons, "день", "дні", "днів")}`
        : `${lessons} ${plural(lessons, "урок", "уроки", "уроків")}`),
    /* The hook leads, the description explains. `summary` says what the course
       IS, which is the right answer to a question somebody has already decided
       to ask; the tagline says why they would ask it. The hero gets the hook
       when the author wrote one, and the summary stays underneath it in the
       method panel. */
    description: course.tagline ?? summary,
    longDescription: summary,
    results: course.results ?? [],
    surfaceType: isMini ? "mini-course" : "program",
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
