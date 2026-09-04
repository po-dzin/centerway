/**
 * The price of a product that is not a course of its own.
 *
 * `lms_course_offers` is unique on `course_id`, so two products could never
 * live there: `way21-support` is a second offer against the way21 course, and
 * `herbs` is not a course at all. Their price stayed in `products.ts`, where
 * only a deployment could change it — and the products sold as an enquiry
 * (`consult`, `irem-individual`) had no price anywhere, because they have no
 * entry in that file either. `product_offers` is their address, and this reads
 * it.
 *
 * A MISSING ROW FALLS BACK TO THE CONSTANT, unlike a course, where no row means
 * "not for sale". The difference is not laziness, it is what the two absences
 * mean. `lms_course_offers` is written by the owner for every course they
 * decide to sell, so an empty row is a decision. These four products have been
 * sold from a hand-written constant for as long as they have existed, so an
 * empty row here is just an absence, and refusing the sale over it would close
 * a live checkout for a reason nobody chose.
 *
 * That fallback is safe in a way the pre-2026-09-02 arrangement was not, and
 * the distinction matters. The way21 bug was never "a default existed" — it was
 * that the LANDING and the CHECKOUT read different sources, so one could move
 * while the other stood still. Everything now goes through `loadPayableOffer`,
 * one function, one answer. A default underneath one function is a default; two
 * sources read by two doors is a bug waiting for a QA window.
 */

import { unstable_cache } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PRODUCT_OFFERS_TAG = "product-offers";

/** Cheap enough to re-read, short enough that an owner sees their own edit. */
const REVALIDATE_SECONDS = 60;

export type ProductOfferKind = "checkout" | "lead";

export type ProductOffer = {
  code: string;
  /** `null` is «ціна за запитом» — a real state, and not the same as zero. */
  amount: number | null;
  listAmount: number | null;
  currency: string;
  kind: ProductOfferKind;
  pixelContentName: string | null;
  active: boolean;
  updatedAt: string | null;
};

type Row = {
  code: string;
  amount: number | null;
  list_amount: number | null;
  currency: string | null;
  kind: string | null;
  pixel_content_name: string | null;
  active: boolean | null;
  updated_at: string | null;
};

export function toProductOffer(row: Row): ProductOffer {
  return {
    code: row.code,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    listAmount: row.list_amount === null || row.list_amount === undefined ? null : Number(row.list_amount),
    currency: row.currency ?? "UAH",
    kind: row.kind === "lead" ? "lead" : "checkout",
    pixelContentName: row.pixel_content_name ?? null,
    active: row.active !== false,
    updatedAt: row.updated_at ?? null,
  };
}

const COLUMNS = "code, amount, list_amount, currency, kind, pixel_content_name, active, updated_at";

async function readProductOffer(code: string): Promise<ProductOffer | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("product_offers")
      .select(COLUMNS)
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) return null;
    return toProductOffer(data as Row);
  } catch {
    /* A price that cannot be read is not a price of zero. The caller falls back
       to the constant, which is what this product was sold for yesterday. */
    return null;
  }
}

export async function loadProductOffer(code: string): Promise<ProductOffer | null> {
  return unstable_cache(() => readProductOffer(code), ["product-offer", code], {
    tags: [PRODUCT_OFFERS_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}
