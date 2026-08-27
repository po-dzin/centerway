/**
 * A course out of the builder, seen as something that can be bought.
 *
 * THE GAP THIS CLOSES. Wave 2 made an author able to edit and publish a course
 * live. Everything that turned a course into a PRODUCT stayed in TypeScript:
 * an entry in `programs`, a hand-written page under /programs, a line in
 * `PRODUCTS`, and a deploy. So the builder was a tool for editing the two
 * courses that already existed. This module is the other half — the offer read
 * from the database rather than from a constant.
 *
 * TWO OWNERS, TWO TABLES, AND THAT IS THE POINT. What the course claims about
 * itself is the author's and lives on `lms_courses`. What it costs is the
 * owner's and lives on `lms_course_offers`, which the authoring API holds no
 * grant on. Reading them together here does not merge them: this module only
 * reads, and the only writer of a price is the admin surface.
 *
 * THE HAND-WRITTEN SIX ARE NOT TOUCHED. `PRODUCTS` stays authoritative for
 * every code it defines. A database offer can only ever answer to a
 * `course:<slug>` code, which `PRODUCTS` cannot contain, so the two namespaces
 * cannot collide and no existing purchase changes shape.
 */

import { unstable_cache } from "next/cache";

import { COURSE_LIST_TAG, courseTag, getLiveCourse, listLiveCourses } from "@/lib/lms/liveCatalog";
import {
  PLATFORM_FAILED_URL,
  PLATFORM_THANKS_URL,
  catalogOffer,
  isCatalogProduct,
  normalizePayableProduct,
  type PayableOffer,
} from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlatformOfferArtwork } from "@/lib/platform/content";
import { toOfferSurface } from "@/lib/platform/courseOffer";
import { offerEyebrow } from "@/lib/platform/offerPreview";
import {
  courseOfferCode,
  inlineToPlainText,
  parseCourseOfferCode,
  type Course,
  type CourseVisibility,
} from "@/lms-core";

/** Offers are cheap to read and change rarely; the tag is what makes it live. */
const REVALIDATE_SECONDS = 300;

export type CourseOffer = {
  /** The payable product code. Always `course:<slug>`. */
  code: string;
  courseId: string;
  courseSlug: string;
  amount: number;
  /** What a page may QUOTE. Null means there is no agreed figure to print. */
  listAmount: number | null;
  currency: string;
  pixelContentName: string;
};

/**
 * The `course:<slug>` namespace now lives in lms-core, beside the entitlement
 * that has to accept the same string — see src/lms-core/offerCode.ts. Re-exported
 * here because this is where the storefront reads it from.
 */
export { courseOfferCode, parseCourseOfferCode };

type Row = Record<string, unknown>;

function toOffer(row: Row, courseSlug: string): CourseOffer {
  return {
    code: row.code as string,
    courseId: row.course_id as string,
    courseSlug,
    amount: Number(row.amount),
    listAmount: row.list_amount === null || row.list_amount === undefined ? null : Number(row.list_amount),
    currency: (row.currency as string) ?? "UAH",
    pixelContentName: row.pixel_content_name as string,
  };
}

async function readOffer(slug: string): Promise<CourseOffer | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("lms_course_offers")
      .select("code, course_id, amount, list_amount, currency, pixel_content_name, active, lms_courses!inner(slug)")
      .eq("code", courseOfferCode(slug))
      .eq("active", true)
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return toOffer(data[0] as Row, slug);
  } catch {
    // A price that cannot be read is not a price of zero and not a free
    // course: the caller renders the offer without a buy button.
    return null;
  }
}

/**
 * The live offer for one course, or null when it is not for sale.
 *
 * NULL IS A NORMAL ANSWER, not an error. Most courses have no offer: they are
 * drafts, or they are delivered some other way, or nobody has agreed a price.
 * Every caller has to render that state rather than assume a number.
 */
export async function loadCourseOffer(slug: string): Promise<CourseOffer | null> {
  return unstable_cache(() => readOffer(slug), ["lms-course-offer", slug], {
    tags: [courseTag(slug), COURSE_LIST_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}

/**
 * Whether a course may be shown to someone who does not own it.
 *
 * `status` is deliberately part of the answer and `visibility` is the other
 * part. A draft is never public no matter what its visibility says — the
 * author has not finished — and a published course is public only as far as it
 * was told to be.
 */
export function isPublicCourse(course: Course, at: CourseVisibility[] = ["listed", "unlisted"]): boolean {
  if (course.status !== "published") return false;
  return at.includes(course.visibility ?? "hidden");
}

/** A listed course, reduced to what a catalogue card needs. */
export type StorefrontCard = {
  slug: string;
  title: string;
  tag: string;
  description: string;
  href: string;
  artwork?: PlatformOfferArtwork;
  /**
   * The card's decorative variant, from a closed list the catalogue's CSS knows.
   *
   * Derived from the course's own palette rather than asked of the author: it is
   * a rendering detail of one surface, and a field in the builder for it would
   * be a control whose effect the author cannot see from where they set it.
   * A course whose palette has no card variant falls back to `stone`, which is
   * the neutral one.
   */
  visual: string;
  /** How the catalogue's two rails are split — see the offer page. */
  lessons: number;
};

/** Course palette → the card variant closest to it. */
const VISUAL_BY_PALETTE: Record<string, string> = {
  way21: "leaf",
  "reset-day": "water",
  herbs: "leaf",
  mineral: "stone",
  default: "stone",
};

/**
 * Every course a stranger may find in the catalogue.
 *
 * `listed` ONLY — `unlisted` has a page and deliberately no shelf position, and
 * `hidden` has neither. The author's own order decides the sequence, the same
 * `sortOrder` their builder grid uses, because the shelf a buyer sees and the
 * shelf the author arranges should not be two different opinions.
 *
 * Never throws. A catalogue that fails to load its live half still has six
 * hand-written programs to show, and an exception here would take those down
 * with it.
 */
export async function listStorefrontCourses(): Promise<StorefrontCard[]> {
  let courses: Course[];
  try {
    courses = await listLiveCourses();
  } catch {
    return [];
  }

  return courses
    .filter((course) => isPublicCourse(course, ["listed"]))
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
    .map((course) => {
      /* THE CARD SAYS WHAT THE PAGE SAYS. The eyebrow, the name and the
         duration are read off the same `toOfferSurface` the offer page is built
         from, so a reader who follows a card meets the two facts they were
         shown, in the same words. This used to be its own opinion — the tagline
         as the eyebrow, the raw title as the name — and it drifted the moment
         a course was authored with a long title. */
      const surface = toOfferSurface(course);
      return {
        slug: course.slug,
        title: surface.title,
        tag: offerEyebrow(surface.tag, surface.duration),
        description: course.summary ? inlineToPlainText(course.summary) : "",
        href: `/programs/${course.slug}`,
        ...(course.cover
          ? {
              artwork: {
                desktop: course.cover.src,
                desktopPosition: `${course.cover.cropX ?? 50}% ${course.cover.cropY ?? 50}%`,
              },
            }
          : {}),
        visual: VISUAL_BY_PALETTE[course.theme?.palette ?? ""] ?? "stone",
        lessons: course.modules.reduce((total, module) => total + module.lessons.length, 0),
      };
    });
}

/**
 * The commercial facts for ANY payable code, whichever namespace it is in.
 *
 * This is the function that defuses the first of the two mines the storefront
 * pass left behind. `resolvePayableProduct` used to answer an unknown code with
 * `"short"`, so a `course:<slug>` button reaching the payment route before this
 * existed would have charged the buyer for Short Reboot. There is no fallback
 * here: an unknown, unpublished or unpriced code answers `null`, and the routes
 * refuse to open a checkout for it.
 *
 * NULL IS THE NORMAL "NOT FOR SALE" ANSWER — a draft, a hidden course, or a
 * course nobody has priced. Only the owner writes `lms_course_offers`, so a
 * missing row is a decision, not an outage.
 */
export async function loadPayableOffer(code: unknown): Promise<PayableOffer | null> {
  const normalized = normalizePayableProduct(code);
  if (!normalized) return null;
  if (isCatalogProduct(normalized)) return catalogOffer(normalized);

  const slug = parseCourseOfferCode(normalized);
  if (!slug) return null;

  const [course, offer] = await Promise.all([getLiveCourse(slug), loadCourseOffer(slug)]);

  // Both halves have to agree, and each says something different: the course
  // says the author finished it and let strangers see it, the offer row says
  // the owner set a price. Selling a draft would deliver a half-written course;
  // selling without a row would charge a figure nobody agreed.
  if (!course || !isPublicCourse(course) || !offer) return null;

  const summary = course.summary ? inlineToPlainText(course.summary) : "";
  const heading = `${course.title} — CenterWay`;
  const description = summary || heading;

  return {
    code: offer.code as `course:${string}`,
    // One language, twice, on purpose: a course written by its author is
    // written in one language, and inventing a translation for a WayForPay
    // invoice line would put words in their mouth.
    heading: { uk: heading, en: heading },
    description: { uk: description, en: description },
    amount: offer.amount,
    listAmount: offer.listAmount ?? offer.amount,
    currency: offer.currency,
    pixelContentName: offer.pixelContentName,
    // Always the platform: a course built here is delivered here. The bot and
    // cabinet shapes belong to products that predate the LMS.
    fulfilment: { kind: "course", courseSlug: slug },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  };
}
