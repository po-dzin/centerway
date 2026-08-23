/**
 * The offer page for a course that came out of the builder.
 *
 * WHY IT EXISTS. Six programs have hand-written pages under this directory, and
 * until now that was the only kind of offer page there was — so a course an
 * author published was reachable at no address at all. Making one needed a
 * developer and a deploy, which is the dependency wave 2 removed from content
 * and left on selling.
 *
 * THE SIX STILL WIN. `/programs/reset-day` is a static segment and this is a
 * dynamic one; Next resolves the static route first, always. So a hand-written
 * page is never shadowed by a database row that happens to share its slug, and
 * this file cannot change what any existing offer says.
 *
 * WHAT DECIDES WHETHER A STRANGER SEES IT. Two fields, and both have to agree:
 * `status` (has the author published the material) and `visibility` (may
 * strangers find it). A draft is never public; a published course is public
 * only as far as it was told to be. `hidden` — the default — 404s here.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProgramDetailPage, type OfferSurface } from "@/components/platform/ProgramDetailPage";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { courseOfferCommerce } from "@/lib/platform/offerCommerce";
import { isPublicCourse, loadCourseOffer } from "@/lib/platform/offers";
import { inlineToPlainText, type Course } from "@/lms-core";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A course, seen as an offer.
 *
 * Every field the page needs has a home on the course already — the author
 * fills them in the builder's «Вітрина» panel. What is missing falls back to
 * something true rather than to a placeholder: a course with no tagline gets
 * the word for what it is, not "Tagline".
 */
function toOfferSurface(course: Course): OfferSurface {
  const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const summary = course.summary ? inlineToPlainText(course.summary) : "";
  // The same threshold the catalogue's two rails use. A course is a "mini" one
  // by how much of someone's life it asks for, and lesson count is the only
  // honest proxy the data actually carries.
  const isMini = lessons <= 8;

  return {
    slug: course.slug,
    title: course.title,
    fullTitle: course.title,
    tag: course.tagline ?? (isMini ? "Міні-курс" : "Програма"),
    duration:
      course.schedule.mode === "daily"
        ? `${lessons} ${plural(lessons, "день", "дні", "днів")}`
        : `${lessons} ${plural(lessons, "урок", "уроки", "уроків")}`,
    description: summary,
    longDescription: summary,
    results: course.results ?? [],
    surfaceType: isMini ? "mini-course" : "program",
    ...(course.cover ? { artwork: { desktop: course.cover.src } } : {}),
  };
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

async function publicCourse(slug: string): Promise<Course | null> {
  const course = await getLiveCourse(slug);
  return course && isPublicCourse(course) ? course : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await publicCourse(slug);
  if (!course) return {};

  const description = course.summary ? inlineToPlainText(course.summary) : course.tagline;

  return pageMetadata({
    title: course.title,
    // The author's own summary when there is one. Falling back to the platform
    // line rather than to nothing: a course with no description at all would
    // inherit the layout's default, which describes the platform and not this.
    description: description || describe(`${course.title} — курс на платформі CenterWay.`),
    path: `/programs/${course.slug}`,
    ...(course.cover ? { image: course.cover.src } : {}),
    // Unlisted means "not in the catalogue and not in search". A page that is
    // reachable by link but indexed anyway would make the setting a lie.
    noindex: course.visibility === "unlisted",
  });
}

export default async function CourseOfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await publicCourse(slug);
  if (!course) notFound();

  /* THE PRICE, AND WHY IT IS READ HERE. The offer row is owner-written and
     lives in a table the authoring routes hold no grant on, so it cannot come
     from the course the author edited. No row means no agreed price, and the
     page falls back to the lead form — the same honest state `herbs` is in. */
  const offer = await loadCourseOffer(course.slug);

  // Passed in rather than looked up: this page has already read the course, and
  // the snapshot lookup inside would find nothing for a course that exists only
  // in the database — which is every course this route serves.
  return (
    <ProgramDetailPage
      program={toOfferSurface(course)}
      course={course}
      commerce={courseOfferCommerce(course.slug, offer)}
    />
  );
}
