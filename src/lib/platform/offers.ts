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
  PRODUCTS,
  catalogOffer,
  formatPrice,
  isCatalogProduct,
  normalizePayableProduct,
  type CatalogProductCode,
  type PayableOffer,
} from "@/lib/products";
import { mediaSources } from "@/lib/lms/media";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadProductOffer } from "@/lib/platform/productOffers";
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
  return set
    .split(", ")
    .map((candidate) => candidate.split(" ")[0])
    .find((url) => url.endsWith("/640.webp"));
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
  /** The line below the title — what kind of thing this is, in their words. */
  posttitle?: string;
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
  const offers = await Promise.all(listed.map((course) => loadCourseOffer(course.slug)));

  return listed.map((course, index) => {
      /* THE CARD SAYS WHAT THE PAGE SAYS. The eyebrow, the name and the
         duration are read off the same `toOfferSurface` the offer page is built
         from, so a reader who follows a card meets the two facts they were
         shown, in the same words. This used to be its own opinion — the tagline
         as the eyebrow, the raw title as the name — and it drifted the moment
         a course was authored with a long title. */
      const surface = toOfferSurface(course);
      const card = course.cover ? coverCard(course.cover.src) : undefined;
      const offer = offers[index];
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
                desktopPosition: `${course.cover.cropX ?? 50}% ${course.cover.cropY ?? 50}%`,
              },
            }
          : {}),
        visual: VISUAL_BY_PALETTE[course.theme?.palette ?? ""] ?? "stone",
        lessons: course.modules.reduce((total, module) => total + module.lessons.length, 0),
        // The cover's own three lines, carried to the card that shows them. The
        // subtitle falls back to the dash-split for courses authored before
        // `posttitle` existed — the same fallback `toOfferSurface` uses, read
        // from it rather than repeated here.
        ...(course.pretitle ? { pretitle: course.pretitle } : {}),
        ...(surface.subtitle ? { posttitle: surface.subtitle } : {}),
        ...(course.categories
          ? {
              categories: course.categories,
              categoryLabels: course.categories.map((one) => COURSE_CATEGORY_LABELS[one]),
            }
          : {}),
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
/**
 * Hand-written codes that name a course sold from the offer table.
 *
 * THE PRICE HAS ONE SOURCE, AND IT IS THE ROW. Every product here is sold
 * through two doors — the funnel landing links `?product=way21`, the storefront
 * charges `course:way21` — and each door used to read a different number: the
 * landing from the constant in `PRODUCTS`, the storefront from
 * `lms_course_offers`. The prose above this list used to warn what that costs,
 * and then covered only `reset-day`. The bill arrived on 2026-09-02: the way21
 * landing was quoting 4100 ₴ in its own CTA and charging 1 ₴, because the QA
 * window had been opened in the constant and the row knew nothing about it.
 *
 * So the legacy code resolves to the same row for every product that IS a
 * course. Money, code and access term come from the row; what stays in the
 * constant is the invoice PROSE, which the database path cannot express — a
 * course row yields one title in one language, and the hand-written entry has a
 * real sentence in both, read by a person on a WayForPay invoice.
 *
 * WHAT IS DELIBERATELY ABSENT. `lms_course_offers` is unique on `course_id` —
 * one course, one offer — so two products structurally cannot be here:
 * `way21-support` is a second offer against the same way21 course, and `herbs`
 * is not a course at all (`fulfilment: cabinet`). They keep their constants,
 * and that is the shape of the table rather than an omission. A price that must
 * live in the database for them needs a table that can hold it.
 *
 * Two consequences, both intended. Withdrawing the offer stops the funnel too,
 * instead of leaving one door selling a course the storefront calls closed. And
 * a QA price is now set where the price is — one UPDATE on the row — rather
 * than in a constant that only half the doors read.
 */
const COURSE_CODE_ALIASES: Partial<Record<CatalogProductCode, string>> = {
  short: "short",
  irem: "irem-gymnastics",
  way21: "way21",
  "reset-day": "reset-day",
};

/**
 * A catalogue product with no course of its own: the price comes from
 * `product_offers`, and from the constant only when there is no row.
 *
 * Two products cannot be in `lms_course_offers` — `way21-support` is a second
 * offer against the way21 course and `herbs` is not a course at all — so before
 * this they were priced in `products.ts`, where only a deployment could change
 * them. See `platform/productOffers.ts` for why an absent row falls back here
 * while an absent COURSE offer refuses the sale instead.
 *
 * The prose stays hand-written for the same reason it does on the aliased path:
 * a WayForPay invoice line is read by a person, and a table row has no sentence
 * in two languages to give them.
 *
 * `amount: null` in the row means «ціна за запитом» and is NOT a price of zero,
 * so it withdraws the checkout rather than opening a free one. `kind: "lead"`
 * does the same: a package agreed in conversation and invoiced afterwards must
 * not become a buy button because somebody typed a figure next to it.
 *
 * THE FALLBACK NEEDS A PRICE TO FALL BACK TO, and one product has none.
 * `listAmount` is already this file's marker for «nobody agreed a figure» —
 * `herbs` carries `null` there with the comment saying so, because it was never
 * sold self-serve and its `amount` is the 1 ₴ QA placeholder. Returning that
 * constant charged a hryvnia for an individual blend on any request the row did
 * not answer: while the row was absent, after an admin deactivated it, and
 * after any read failure, since `loadProductOffer` reports all three the same
 * way. So the fallback applies to a constant that quotes a price and refuses
 * for one that does not — no price means the enquiry form, which is the state
 * this product was always in.
 */
async function productOffer(code: CatalogProductCode): Promise<PayableOffer | null> {
  const base = catalogOffer(code);
  const row = await loadProductOffer(code);
  if (!row) return base.listAmount === null ? null : base;

  if (row.kind === "lead" || row.amount === null || row.amount <= 0) return null;

  return {
    ...base,
    amount: row.amount,
    listAmount: row.listAmount ?? base.listAmount,
    currency: row.currency,
    pixelContentName: row.pixelContentName ?? base.pixelContentName,
  };
}

export async function loadPayableOffer(code: unknown): Promise<PayableOffer | null> {
  const normalized = normalizePayableProduct(code);
  if (!normalized) return null;

  if (isCatalogProduct(normalized)) {
    const aliasSlug = COURSE_CODE_ALIASES[normalized];
    if (!aliasSlug) return productOffer(normalized);

    const aliased = await loadCourseOfferFor(aliasSlug);
    if (!aliased) return null;

    const { heading, description } = PRODUCTS[normalized];
    return { ...aliased, heading, description };
  }

  const slug = parseCourseOfferCode(normalized);
  if (!slug) return null;
  return loadCourseOfferFor(slug);
}

/** The commercial facts for one course, read from its own row. */
async function loadCourseOfferFor(slug: string): Promise<PayableOffer | null> {
  const [course, offer] = await Promise.all([getLiveCourse(slug), loadCourseOffer(slug)]);

  // Both halves have to agree, and each says something different: the course
  // says the author finished it and let strangers see it, the offer row says
  // the owner set a price. Selling a draft would deliver a half-written course;
  // selling without a row would charge a figure nobody agreed.
  if (!course || !isPublicCourse(course) || !offer || offer.amount <= 0) return null;

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
    // Always the platform: a course built here is delivered here. The cabinet
    // shape belongs to a product that predates the LMS, and nothing is
    // delivered by a bot any more.
    //
    // Both slugs named rather than one: the buyer reads at /learn/<slug> and is
    // returned to /programs/<programSlug>, which are different strings for any
    // course sold under a name older than its row.
    fulfilment: { kind: "course", courseSlug: slug, programSlug: course.programSlug },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  };
}
