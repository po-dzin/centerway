/**
 * The offer page for a course that came out of the builder.
 *
 * WHY IT EXISTS. Six programs have hand-written pages under this directory, and
 * until now that was the only kind of offer page there was — so a course an
 * author published was reachable at no address at all. Making one needed a
 * developer and a deploy, which is the dependency wave 2 removed from content
 * and left on selling.
 *
 * A HAND-WRITTEN PAGE STILL WINS. A static segment beats a dynamic one in Next,
 * always, so `/programs/irem` is served by its own file and never by a database
 * row that happens to share its slug. Five of the original six still are.
 *
 * RESET DAY IS NOT, since 2026-08-26 — it was the first to move here in full.
 * Its page came from `content.ts`, its price from a constant, and both said
 * things the course itself said better; one of them, its duration, had drifted
 * into contradicting the landing that sells it. It is now an ordinary listed
 * course: copy from the builder, price from `lms_course_offers`, served by this
 * file. The remaining five each need the same three things before they can
 * follow — an offer row, a visibility, and a decision about what they charge.
 *
 * WHAT DECIDES WHETHER A STRANGER SEES IT. Two fields, and both have to agree:
 * `status` (has the author published the material) and `visibility` (may
 * strangers find it). A draft is never public; a published course is public
 * only as far as it was told to be. `hidden` — the default — 404s here.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { OfferPurchaseReturn, readPurchaseReturn } from "@/components/platform/OfferPurchaseReturn";
import { getCourseAuthor } from "@/lib/lms/authors";
import { toOfferSurface } from "@/lib/platform/courseOffer";
import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { courseOfferCommerce } from "@/lib/platform/offerCommerce";
import { isPublicCourse, loadCourseOffer, loadPayableOffer } from "@/lib/platform/offers";
import { courseOfferCode, inlineToPlainText, type Course } from "@/lms-core";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

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
    ...(course.cover ? { image: course.cover.src, imageAlt: course.cover.alt } : {}),
    // Unlisted means "not in the catalogue and not in search". A page that is
    // reachable by link but indexed anyway would make the setting a lie.
    noindex: course.visibility === "unlisted",
  });
}

export default async function CourseOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /* Present only when the payment route sent a buyer back here. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const course = await publicCourse(slug);
  if (!course) notFound();

  /* THE PRICE, AND WHY IT IS READ HERE. The offer row is owner-written and
     lives in a table the authoring routes hold no grant on, so it cannot come
     from the course the author edited. No row means no agreed price, and the
     page falls back to the lead form — the same honest state `herbs` is in. */
  /* Both reads at once: they are independent, and a byline should not wait on a
     price. Neither can fail the page — `loadCourseOffer` falls back to the lead
     form and `getCourseAuthor` to no byline at all. */
  const [offer, author, query] = await Promise.all([
    loadCourseOffer(course.slug),
    getCourseAuthor(course.slug),
    searchParams,
  ]);

  /* THE CODE COMES FROM THE RETURN, not from the course.
     One course can be sold under several codes and reset-day is the live proof:
     the platform charges `course:reset-day`, the funnel landing still charges
     `reset-day`, and older orders are filed under `mini-detox`. All three open
     the same course, so all three can land here — and a receipt that printed
     this page's own code would name a product the buyer did not buy, and file
     the browser Purchase against it. */
  const returnedCode =
    typeof query.product === "string" && query.product ? query.product : courseOfferCode(course.slug);
  const payable = await loadPayableOffer(returnedCode);
  const returned = readPurchaseReturn(query, payable);

  // Passed in rather than looked up: this page has already read the course, and
  // the snapshot lookup inside would find nothing for a course that exists only
  // in the database — which is every course this route serves.
  return (
    <ProgramDetailPage
      program={toOfferSurface(course)}
      course={course}
      commerce={courseOfferCommerce(course.slug, offer)}
      author={author}
      purchase={
        returned ? <OfferPurchaseReturn purchase={{ ...returned, product: returnedCode }} /> : undefined
      }
    />
  );
}
