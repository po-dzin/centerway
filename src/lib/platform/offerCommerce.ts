/**
 * How a catalogue offer converts on the PLATFORM page.
 *
 * Until now every platform offer page ended in the same lead form, including
 * the four products that have had a working WayForPay checkout on their funnel
 * for months. A buyer who reached /programs/reset-day — from search, from the
 * catalogue, from the header — could not buy the thing the page was selling.
 * They could only ask to be told how.
 *
 * One rule decides it, and it is not a per-page opinion: an offer that has a
 * payable product code sells itself; an offer that does not is sold in
 * conversation and keeps the form. That is the same split
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
  type PayableProductCode,
} from "@/lib/products";

export type OfferCommerce =
  | {
      mode: "checkout";
      productCode: PayableProductCode;
      /** Site-relative; a plain link, because /api/pay/start redirects on GET. */
      checkoutHref: string;
      /** Already formatted — a checkout without a quoted price is not offered. */
      price: string;
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
const PAYABLE_BY_SLUG: Partial<Record<string, PayableProductCode>> = {
  reboot: "short",
  "reset-day": "reset-day",
  way21: "way21",
  irem: "irem",
  herbs: "herbs",
};

/**
 * The lead code for an offer that is not self-serve.
 *
 * `ideal-body` has no price and no funnel of its own; the consultation is
 * agreed in conversation on purpose. Both are in LEAD_PRODUCT_CODES.
 */
const LEAD_BY_SLUG: Partial<Record<string, string>> = {
  "ideal-body": "ideal-body",
  consult: "consult",
  herbs: "herbs",
};

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
      checkoutHref: `/api/pay/start?product=${encodeURIComponent(productCode)}&cta_place=${encodeURIComponent(
        `${slug}_platform_offer`
      )}&source=platform_offer`,
      price: formatPrice(listed, PRODUCTS[productCode].currency),
    };
  }

  return { mode: "lead", leadProductCode: LEAD_BY_SLUG[slug] ?? "platform" };
}
