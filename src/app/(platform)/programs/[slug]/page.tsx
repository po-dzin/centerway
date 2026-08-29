/**
 * The offer page for a course that came out of the builder.
 *
 * WHY IT EXISTS. Six programs have hand-written pages under this directory, and
 * until now that was the only kind of offer page there was — so a course an
 * author published was reachable at no address at all. Making one needed a
 * developer and a deploy, which is the dependency wave 2 removed from content
 * and left on selling.
 *
 * NOTHING HAND-WRITTEN IS LEFT, since 2026-08-29. Reset Day moved here first
 * (2026-08-26), Way 21 and «Природнє тіло» followed, and the last two — Short
 * Reboot and IREM — came across with this note. `content.ts` keeps `herbs`,
 * which is a product and not a course, and the catalogue is otherwise read
 * from the database end to end.
 *
 * THE ADDRESS IS THE PROGRAM SLUG, NOT THE COURSE SLUG. Those two strings were
 * equal for every course that had moved here so far, which made the difference
 * invisible; they are not equal for the last two. The course `short` is sold at
 * `/programs/reboot` and `irem-gymnastics` at `/programs/irem` — names that are
 * years old, indexed, printed on funnel landings and joined against by the
 * shelf entry a buyer already owns (see OfferAccess). Serving them at their row
 * names would have been a rename disguised as a refactor.
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
import { listLiveCourses } from "@/lib/lms/liveCatalog";
import { courseOfferCommerce } from "@/lib/platform/offerCommerce";
import { isPublicCourse, loadCourseOffer, loadPayableOffer } from "@/lib/platform/offers";
import { courseOfferCode, inlineToPlainText, type Course } from "@/lms-core";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * The course sold at this address, when a stranger may see it.
 *
 * Matched on `programSlug` and on nothing else — one course, one public
 * address. Resolving the row name as well would give every renamed course two
 * live URLs printing the same page, which is the duplicate this route exists to
 * avoid rather than create.
 */
async function publicCourse(address: string): Promise<Course | null> {
  const course = (await listLiveCourses()).find((one) => one.programSlug === address);
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
    path: `/programs/${course.programSlug}`,
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
      commerce={courseOfferCommerce(course.programSlug, offer)}
      author={author}
      purchase={
        returned ? <OfferPurchaseReturn purchase={{ ...returned, product: returnedCode }} /> : undefined
      }
    />
  );
}
