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
 * owner's and lives on `experience_offers`, which the authoring API holds no
 * grant on. Reading them together here does not merge them: this module only
 * reads, and the only writer of a price is the admin surface.
 *
 * ONE TABLE OF PRICES SINCE 2026-09-26. The hand-written six that used to sit
 * beside it in `products.ts` are gone; every price, invoice line and old code
 * spelling is a row of `experience_offers` or `offer_aliases`, and every door
 * reaches it through `loadPayableOffer` below.
 */

import { coverArtworkFraming } from "@/lib/lms/courseCover";
import { unstable_cache } from "next/cache";

import { COURSE_LIST_TAG, courseTag, getLiveCourse, listLiveCourses } from "@/lib/lms/liveCatalog";
import {
  PLATFORM_FAILED_URL,
  PLATFORM_THANKS_URL,
  formatPrice,
  type PayableOffer,
  type PayableProductCode,
} from "@/lib/products";
import { mediaSources } from "@/lib/lms/media";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FORMAT_DEFAULT_LABELS, isOfferFormat, loadProgramFormats } from "@/lib/experiences/formats";
import {
  describeOffer,
  isPayable,
  offerFulfilment,
  type ExperienceOffer,
  type OfferTarget,
} from "@/lib/experiences/offers";
import { isContentKind } from "@/lib/experiences/registry";
import type { PlatformOfferArtwork } from "@/lib/platform/content";
import { toOfferSurface } from "@/lib/platform/courseOffer";
import { COURSE_CATEGORY_LABELS } from "@/lib/platform/catalogVocabulary";
import { offerEyebrow } from "@/lib/platform/offerPreview";

/**
 * The card-sized copy of an uploaded cover, when there is one.
 *
 * `mediaSources` answers "does this address have smaller renditions" for
 * exactly one kind of address — an upload this application made — and returns
 * nothing for a repository path or a pasted link. A catalogue card is ~370 CSS
 * pixels wide, so the 640 rendition is the right one to hand it.
 */
function coverCard(src: string): string | undefined {
  const set = mediaSources(src).srcSet;
  if (!set) return undefined;
  return (
    set
      .split(", ")
      // A string split always yields at least one element; the default never applies.
      .map((candidate) => {
        const [url = ""] = candidate.split(" ");
        return url;
      })
      .find((url) => url.endsWith("/640.webp"))
  );
}
import {
  courseOfferCode,
  inlineToPlainText,
  parseCourseOfferCode,
  type Course,
  type CourseCategory,
  type CourseKind,
  type CourseVisibility,
} from "@/lms-core";

/** Offers are cheap to read and change rarely; the tag is what makes it live. */
const REVALIDATE_SECONDS = 300;

export type CourseOffer = {
  /** The payable product code. Always `course:<slug>`. */
  code: string;
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
      /* THE ONE TABLE OF PRICES (2026-09-20). Since 2026-09-25 the owner's
         catalogue writes here directly — see `lib/experiences/offers.ts`. */
      .from("experience_offers")
      .select("code, amount, list_amount, currency, pixel_content_name, active")
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
  /**
   * The author's display name, for the byline under the categories. Not set
   * here: `offers.ts` sits below `lib/lms/authors.ts` in the import graph, so
   * the rails that print cards fill it through `withAuthorNames()`.
   */
  authorName?: string;
  /** The course's identity — its row, its lessons, its cache tag. */
  slug: string;
  /**
   * The address the offer is sold at, which is not always the slug.
   *
   * `short` is sold as `/programs/reboot` and `irem-gymnastics` as
   * `/programs/irem`: both names are years old, indexed, and printed on
   * funnels. Carried on the card so every list that renders one — the
   * catalogue, the home rails, the sitemap, llms.txt — links the address a
   * reader already has instead of the row name.
   */
  programSlug: string;
  title: string;
  tag: string;
  description: string;
  href: string;
  /** Commercial state is always explicit; a missing row is an inquiry, not zero. */
  commercialMode: "fixed" | "free" | "inquiry";
  price: string | null;
  compareAtPrice: string | null;
  /**
   * The figure behind `price`, for the surfaces that COMPARE rather than print.
   *
   * `price` is already formatted («1 795 ₴», «Безкоштовно») and a formatted
   * string cannot be put inside an interval — parsing it back would mean
   * teaching a filter to un-format a currency, in every locale the storefront
   * ever gains. Null is «ціна за запитом» and is deliberately not zero: see
   * `catalogQuery.ts`, where the three commercial states stay three.
   */
  amount: number | null;
  /** The currency `amount` is in; null wherever `amount` is. */
  currency: string | null;
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
  /**
   * The author's own line above the title, when they wrote one. Not the badge:
   * the badge is the kind and the duration, in the platform's words on every
   * card; this is the one line that is theirs.
   */
  pretitle?: string;
  /**
   * What the course is about, as codes from the closed list. Codes, not labels,
   * because the same card is the thing a category filter will read.
   */
  categories?: CourseCategory[];
  /**
   * The kind, as the word a card prints in its corner. Absent for a course
   * whose author has not said, and the kind then stays inside `tag` — which is
   * exactly what every card did before this existed.
   */
  kindBadge?: string;
  /** `categories`, in the words a reader sees. Codes never reach a component. */
  categoryLabels?: string[];
  /**
   * The kind as its CODE, beside `kindBadge`'s word.
   *
   * The badge is for reading and this is for filtering — the same split as
   * `categories` / `categoryLabels`, and for the same reason: a control that
   * narrowed by the printed word would break the day a badge is reworded.
   */
  kind?: CourseKind;
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

  const listed = courses
    .filter((course) => isPublicCourse(course, ["listed"]))
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
  const [offers, formatSets] = await Promise.all([
    Promise.all(listed.map((course) => loadCourseOffer(course.slug))),
    Promise.all(listed.map((course) => loadProgramFormats(course))),
  ]);

  return listed.map((course, index) => {
    const offer = offers[index] ?? null;
    /* SEVERAL WAYS THROUGH IT, SEVERAL PRICES (2026-09-25). A program sold in
       formats quotes the lowest of them as «від …», the same figure its page's
       hero prints — a card showing only the self-paced price would read as the
       whole offer. `amount` stays the lowest figure, for the price filter. */
    const priced = (formatSets[index] ?? []).filter(
      (format) => format.mode === "checkout" && format.amount !== null && format.amount > 0,
    );
    const lowest = (formatSets[index] ?? []).length >= 2 ? priced.sort((a, b) => a.amount! - b.amount!)[0] : undefined;
    if (lowest && lowest.amount !== null) {
      return {
        ...storefrontCard(course, index, offer),
        commercialMode: "fixed" as const,
        price: `від ${formatPrice(lowest.amount, lowest.currency)}`,
        amount: lowest.amount,
        currency: lowest.currency,
        compareAtPrice: null,
      };
    }
    return storefrontCard(course, index, offer);
  });

  function storefrontCard(course: Course, index: number, offer: CourseOffer | null): StorefrontCard {
    /* THE CARD SAYS WHAT THE PAGE SAYS. The eyebrow, the name and the
         duration are read off the same `toOfferSurface` the offer page is built
         from, so a reader who follows a card meets the two facts they were
         shown, in the same words. This used to be its own opinion — the tagline
         as the eyebrow, the raw title as the name — and it drifted the moment
         a course was authored with a long title. */
    const surface = toOfferSurface(course);
    const card = course.cover ? coverCard(course.cover.src) : undefined;
    return {
      slug: course.slug,
      programSlug: course.programSlug,
      title: surface.title,
      /* THE EYEBROW LOSES THE KIND WHEN THE CORNER GAINS IT. Printing
           «Міні-курс» in a chip on the plate and again in the line under it is
           the same word twice on a card with three text rows. A course whose
           author has not set a kind keeps the old, joined eyebrow — the
           derivation still runs, it just has nowhere better to go. */
      tag: course.kind ? surface.duration : offerEyebrow(surface.tag, surface.duration),
      ...(course.kind ? { kindBadge: surface.tag, kind: course.kind } : {}),
      description: course.summary ? inlineToPlainText(course.summary) : "",
      href: `/programs/${course.programSlug}`,
      commercialMode: offer ? (offer.amount === 0 ? "free" : "fixed") : "inquiry",
      price: offer ? (offer.amount === 0 ? "Безкоштовно" : formatPrice(offer.amount, offer.currency)) : null,
      amount: offer ? offer.amount : null,
      currency: offer ? offer.currency : null,
      // A free course quotes its former price too — see the free branch of
      // `courseOfferCommerce`. The one rule is that the quoted figure is
      // strictly above the charged one, which zero satisfies like any other.
      compareAtPrice:
        offer && offer.listAmount !== null && offer.listAmount !== undefined && offer.listAmount > offer.amount
          ? formatPrice(offer.listAmount, offer.currency)
          : null,
      ...(course.cover
        ? {
            artwork: {
              desktop: course.cover.src,
              // An author's own upload has a 640px rendition beside it, and a
              // catalogue card is the place that wants it. A cover that came
              // from the repository instead has no such sibling to promise,
              // so the card falls back to the full plate as it always did.
              ...(card ? { card } : {}),
              ...coverArtworkFraming(course.cover),
            },
          }
        : {}),
      visual: VISUAL_BY_PALETTE[course.theme?.palette ?? ""] ?? "stone",
      lessons: course.modules.reduce((total, module) => total + module.lessons.length, 0),
      // The author’s optional hook, carried to the card that shows it.
      ...(course.pretitle ? { pretitle: course.pretitle } : {}),
      ...(course.categories
        ? {
            categories: course.categories,
            categoryLabels: course.categories.map((one) => COURSE_CATEGORY_LABELS[one]),
          }
        : {}),
    };
  }
}

/**
 * The commercial facts for ANY payable code, whichever spelling it arrives in.
 *
 * ONE CHANNEL (2026-09-25). The code goes to `describeOffer`, which answers
 * from `experience_offers` and `offer_aliases` and nothing else — the landing's
 * `?product=way21`, the storefront's `course:way21` and a cohort's
 * `way21-group` are rows or aliases of one table, not three code paths.
 * `normalizeProduct`, the hand-written `COURSE_CODE_ALIASES` and the fallback to
 * the constants in `PRODUCTS` are gone, and with them the case where one door
 * read a price the other did not.
 *
 * The code on the answer is the offer's OWN code, not the spelling that came
 * in, so every order a door writes is filed under the name the offer carries.
 *
 * NULL IS THE NORMAL "NOT FOR SALE" ANSWER, and there is no fallback: an
 * unknown code, an inactive or unpriced offer, a lead or free offer, a draft or
 * hidden course all refuse the checkout. A read that fails refuses it too — a
 * price that cannot be read is not a price.
 */
export async function loadPayableOffer(code: unknown): Promise<PayableOffer | null> {
  let target: OfferTarget | null;
  try {
    target = await describeOffer(supabaseAdmin(), code);
  } catch (error) {
    console.warn("payable_offer_read_failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
  if (!target || !isPayable(target.offer)) return null;
  const { offer } = target;

  let title = target.experience.title ?? offer.code;
  let summary = "";
  if (isContentKind(target.experience.kind)) {
    // Both halves have to agree: the course says the author finished it and
    // let strangers see it, the offer says the owner set a price. Selling a
    // draft would deliver a half-written course, and a thing whose course row
    // is gone has nothing to deliver at all.
    const course = target.course ? await getLiveCourse(target.course.slug) : null;
    if (!course || !isPublicCourse(course)) return null;
    title = course.title;
    summary = course.summary ? inlineToPlainText(course.summary) : "";
  }

  /* The invoice line the owner wrote, when there is one. Otherwise it is built
     from the course's own title in its one language — inventing a translation
     for a gateway invoice would put words in the author's mouth — and a format
     of a program says which format was bought. */
  const named = offer.format && offer.format !== "self" ? `${title} — ${formatLabel(offer).toLowerCase()}` : title;
  const fallbackHeading = `${named} — CenterWay`;
  const fallbackDescription = summary || fallbackHeading;

  return {
    code: offer.code as PayableProductCode,
    heading: offer.invoiceHeading ?? { uk: fallbackHeading, en: fallbackHeading },
    description: offer.invoiceDescription ?? { uk: fallbackDescription, en: fallbackDescription },
    amount: offer.amount,
    listAmount: offer.listAmount ?? offer.amount,
    currency: offer.currency,
    pixelContentName: offer.pixelContentName ?? title,
    fulfilment: offerFulfilment(target),
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  };
}

function formatLabel(offer: ExperienceOffer): string {
  return offer.label ?? (isOfferFormat(offer.format) ? FORMAT_DEFAULT_LABELS[offer.format] : offer.code);
}
