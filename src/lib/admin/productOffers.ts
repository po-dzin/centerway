/**
 * The owner's prices for products that are not a course of their own.
 *
 * WHY THIS SERVICE EXISTS. `admin/catalog` gave the owner the price of a
 * COURSE. Everything else was unreachable: `way21-support` and `herbs` were
 * priced in `products.ts`, so changing them meant a deployment, and the
 * enquiry products (`consult`, `irem-individual`) had no price anywhere at all
 * — they are not even in that file. «Поставить цену пакета супровода» was not
 * an act the admin surface could perform.
 *
 * SAME SPLIT AS THE COURSE PRICE: read is open to any admin session, because
 * knowing what something costs is part of answering a buyer; write is
 * admin-only, because the price is the owner's. `product_offers` carries a
 * single admin policy to say so, mirroring `lms_course_offers`.
 */

import { AccessError } from "@/lib/admin/access";
import { adminClient } from "@/lib/auth/adminClient";
import { toProductOffer } from "@/lib/platform/productOffers";
import type { ProductOffer, ProductOfferKind, ProductOfferRow } from "@/lib/admin/productOfferTypes";

// From the one table of prices (2026-09-25); `mode` there is `kind` here,
// translated in `fromRow` rather than by a column alias.
const COLUMNS = "code, amount, list_amount, currency, mode, pixel_content_name, active, updated_at";

function fromRow(row: Record<string, unknown>): ProductOffer {
  return toProductOffer({ ...row, kind: row.mode === "lead" ? "lead" : "checkout" } as Parameters<
    typeof toProductOffer
  >[0]);
}

/**
 * The codes this screen may price, and what each one is.
 *
 * A fixed list rather than "whatever is in the table", because a price row for
 * an unknown code is not a product — nothing would read it, and it would sit
 * in the admin looking like a live offer. `natural-body` is deliberately absent:
 * it already has a row in `lms_course_offers`, and a second figure here would
 * restore the two-sources-for-one-price bug that 2026-09-02 removed.
 */
export const PRICEABLE_PRODUCTS: Array<{ code: string; title: string; kind: ProductOfferKind }> = [
  { code: "herbs", title: "Фітозбір — індивідуальний підбір", kind: "checkout" },
  { code: "consult", title: "Консультація", kind: "lead" },
  { code: "irem-individual", title: "IREM — індивідуально", kind: "lead" },
];

export async function listProductOffers(): Promise<ProductOfferRow[]> {
  const { data, error } = await adminClient()
    .from("experience_offers")
    .select(COLUMNS)
    .in(
      "code",
      PRICEABLE_PRODUCTS.map((product) => product.code),
    );
  if (error) throw new AccessError(error.message, 500);

  const byCode = new Map(
    (data ?? []).map((row) => {
      const offer = fromRow(row as Record<string, unknown>);
      return [offer.code, offer];
    }),
  );

  /* Driven by the list, not by the table: a product with no row yet has to
       appear on the screen, or the owner cannot give it its first price. */
  return PRICEABLE_PRODUCTS.map((product) => ({
    code: product.code,
    title: product.title,
    expectedKind: product.kind,
    offer: byCode.get(product.code) ?? null,
  }));
}

export type SaveProductOfferInput = {
  code: string;
  /** `null` is «ціна за запитом» — an allowed, meaningful value. */
  amount: number | null;
  listAmount: number | null;
  currency?: string;
  kind: ProductOfferKind;
};

export async function saveProductOffer(input: SaveProductOfferInput): Promise<ProductOffer> {
  const known = PRICEABLE_PRODUCTS.find((product) => product.code === input.code);
  if (!known) throw new AccessError("product_unknown", 404);

  if (input.kind !== "checkout" && input.kind !== "lead") throw new AccessError("product_kind_invalid", 400);

  /* NULL is a price, and zero is not. «За запитом» is an ordinary state for a
       package agreed in conversation, and the surface has to be able to say it
       rather than print a nought. */
  if (input.amount !== null && (!Number.isInteger(input.amount) || input.amount <= 0)) {
    throw new AccessError("product_amount_invalid", 400);
  }

  if (input.listAmount !== null) {
    // The struck-through figure is what the page quotes; at or below the
    // charged price it advertises a discount running the wrong way. And
    // there is nothing to strike through when no price is agreed at all.
    if (input.amount === null) throw new AccessError("product_list_amount_without_amount", 400);
    if (!Number.isInteger(input.listAmount) || input.listAmount <= input.amount) {
      throw new AccessError("product_list_amount_invalid", 400);
    }
  }

  /* Written to the one table of prices (2026-09-25). A product's price belongs
     to its thing in the registry, found by the same slug as the code; a
     product with no thing has nowhere to put a price, and says so. A missing
     figure is stored as a lead: a checkout without an amount has never opened. */
  const db = adminClient();
  const { data: thing } = await db.from("experiences").select("id").eq("slug", input.code).maybeSingle();
  if (!thing) throw new AccessError("product_not_registered", 409);
  const { data, error } = await db
    .from("experience_offers")
    .upsert(
      {
        experience_id: thing.id as string,
        code: input.code,
        amount: input.amount,
        list_amount: input.listAmount,
        currency: (input.currency ?? "UAH").toUpperCase(),
        mode: input.kind === "lead" || input.amount === null ? "lead" : "checkout",
        active: true,
        review_status: "approved",
      },
      { onConflict: "code" },
    )
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("product_offer_save_failed", 500);

  /* `pixel_content_name` is never written here. Meta's reporting history is
       joined on it, so it is set once at seed time and left alone — the same
       rule the course offer follows across a slug rename. */
  return fromRow(data as Record<string, unknown>);
}

export async function setProductOfferActive(code: string, active: boolean): Promise<ProductOffer> {
  if (!PRICEABLE_PRODUCTS.some((product) => product.code === code)) {
    throw new AccessError("product_unknown", 404);
  }

  const { data, error } = await adminClient()
    .from("experience_offers")
    .update({ active })
    .eq("code", code)
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("product_offer_not_found", 404);
  return fromRow(data as Record<string, unknown>);
}
