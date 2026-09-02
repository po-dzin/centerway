/**
 * How a catalogue offer converts on the PLATFORM page.
 *
 * Until now every platform offer page ended in the same lead form, including
 * the four products that have had a working WayForPay checkout on their funnel
 * for months. A buyer who reached /programs/reset-day — from search, from the
 * catalogue, from the header — could not buy the thing the page was selling.
 * They could only ask to be told how.
 *
 * One rule decides it, and it is not a per-page opinion: an offer with a
 * positive amount sells itself; a zero amount starts the LMS directly; an
 * offer that does not exist is sold in conversation and keeps the form. That is the same split
 * `docs/checkout-test-flow-2026-08-21.md` settled for the landings, so the two
 * surfaces cannot drift into disagreeing about what is buyable.
 *
 * The quoted figure comes from `productListPrice`, never from the charged
 * amount — see the CW_TEST_PRICE_1UAH note in src/lib/products.ts.
 */

import {
  formatPrice,
  productListPrice,
  PRODUCTS,
  type CatalogProductCode,
  type PayableProductCode,
} from "@/lib/products";
import type { CourseOffer } from "@/lib/platform/offers";

export type OfferCommerce =
  | {
      mode: "checkout";
      productCode: PayableProductCode;
      /** Site-relative; a plain link, because /api/pay/start redirects on GET. */
      checkoutHref: string;
      /** Already formatted — a checkout without a quoted price is not offered. */
      price: string;
      /** Former public price, shown struck through only when it exceeds `price`. */
      compareAtPrice: string | null;
      /**
       * The same figure unformatted, and the currency it is in.
       *
       * Structured data needs a number: `"4 100 ₴"` is what a person reads and
       * `4100` + `"UAH"` is what an Offer node states. Both are derived from
       * one source here so a page cannot print one price and publish another.
       */
      amount: number;
      currency: string;
    }
  | {
      mode: "free";
      /** The learner's destination; no payment route is opened. */
      accessHref: string;
      price: "Безкоштовно";
      /**
       * What this course COSTS when it is not being given away — struck
       * through beside the word «безкоштовно», exactly as on a paid offer.
       *
       * Free is a price, not the absence of one, and «було 795 ₴» is the
       * sentence that says why a free thing is worth the hour it asks for.
       * Null when the owner has not quoted a figure; never invented from the
       * hand-written tables, which describe a different product.
       */
      compareAtPrice: string | null;
      amount: 0;
      currency: string;
    }
  | {
      mode: "lead";
      /** The code the lead is filed under — `/api/leads` needs one. */
      leadProductCode: string;
    };

/**
 * Catalogue slug → payable product.
 *
 * Explicit, not derived: the two vocabularies genuinely differ ("reboot" is
 * sold as "short"), and a clever mapping would silently make a new catalogue
 * entry buyable the moment someone happened to name it after a product.
 */
const PAYABLE_BY_SLUG: Partial<Record<string, CatalogProductCode>> = {
  reboot: "short",
  "reset-day": "reset-day",
  way21: "way21",
  irem: "irem",
  herbs: "herbs",
};

/**
 * The lead code for an offer that is not self-serve.
 *
 * `natural-body` has no price and no funnel of its own; the consultation is
 * agreed in conversation on purpose. Both are in LEAD_PRODUCT_CODES.
 */
const LEAD_BY_SLUG: Partial<Record<string, string>> = {
  "natural-body": "natural-body",
  consult: "consult",
  herbs: "herbs",
};

/** The site-relative link that starts a checkout for one payable code. */
function checkoutHref(productCode: PayableProductCode, slug: string): string {
  return `/api/pay/start?product=${encodeURIComponent(productCode)}&cta_place=${encodeURIComponent(
    `${slug}_platform_offer`
  )}&source=platform_offer`;
}

/**
 * How a course out of the BUILDER converts.
 *
 * Same rule as the six, read from the other place: an active offer row means a
 * price the owner agreed, and a price the owner agreed means a buy button. With
 * no row the answer is whatever `resolveOfferCommerce` gives the same address —
 * a hand-written checkout where one exists, and otherwise the lead form, which
 * is exactly the state `herbs` is in.
 *
 * `amount` is the current price and `listAmount` is the optional former price,
 * exactly as the admin labels and validates them. The latter never replaces
 * the former: it is rendered only when it is strictly greater.
 */
export function courseOfferCommerce(slug: string, offer: CourseOffer | null): OfferCommerce {
  /* NO ROW IS NOT THE SAME AS NOT FOR SALE — it means nobody has written the
     course's price into `lms_course_offers` YET, and two of them are already
     sold under a hand-written code: `/programs/reboot` charges `short` and
     `/programs/irem` charges `irem`, both live, both through a Telegram bot
     that the course-entitlement path does not deliver. When those two pages
     stopped being hand-written this branch was the whole difference between
     keeping a working checkout and quietly replacing it with a lead form.

     So the hand-written answer is the fallback rather than a lead code guessed
     from nothing: the database offer wins where there is one, and where there
     is not, the offer converts exactly the way it did the day before it moved.
     `slug` is the PROGRAM slug for that reason — it is the vocabulary both
     tables below are keyed in. */
  if (!offer) return resolveOfferCommerce(slug);

  if (offer.amount === 0) {
    return {
      mode: "free",
      accessHref: `/learn/${encodeURIComponent(offer.courseSlug)}`,
      price: "Безкоштовно",
      compareAtPrice:
        offer.listAmount !== null && offer.listAmount > 0
          ? formatPrice(offer.listAmount, offer.currency)
          : null,
      amount: 0,
      currency: offer.currency,
    };
  }

  return {
    mode: "checkout",
    productCode: offer.code as PayableProductCode,
    checkoutHref: checkoutHref(offer.code as PayableProductCode, slug),
    price: formatPrice(offer.amount, offer.currency),
    compareAtPrice:
      offer.listAmount !== null && offer.listAmount > offer.amount
        ? formatPrice(offer.listAmount, offer.currency)
        : null,
    amount: offer.amount,
    currency: offer.currency,
  };
}

export function resolveOfferCommerce(slug: string): OfferCommerce {
  const productCode = PAYABLE_BY_SLUG[slug];

  /* No agreed price means no self-serve checkout — the offer falls back to the
     form. `herbs` is the live case: it has a WayForPay route and a 1 ₴ QA
     amount, but no price anyone has decided to charge. A buy button over a
     figure nobody agreed is worse than asking. */
  const listed = productCode ? productListPrice(productCode) : null;

  if (productCode && listed !== null) {
    return {
      mode: "checkout",
      productCode,
      checkoutHref: checkoutHref(productCode, slug),
      price: formatPrice(listed, PRODUCTS[productCode].currency),
      compareAtPrice: null,
      amount: listed,
      currency: PRODUCTS[productCode].currency,
    };
  }

  return { mode: "lead", leadProductCode: LEAD_BY_SLUG[slug] ?? "platform" };
}
