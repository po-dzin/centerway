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
 * What this screen may price: every thing in the registry with no course
 * behind it — a consultation, a package, a physical product. Read from
 * `experiences` (2026-09-26) rather than kept as a list here: a new
 * consultation registered by the owner appears on the screen without a deploy.
 *
 * A course is priced on its own screen (the catalogue) and never here; a
 * second figure for it would restore the two-sources-for-one-price bug that
 * 2026-09-02 removed. The code of a thing's offer is its slug.
 */
const PRICEABLE_KINDS = ["consultation", "package", "physical"] as const;

type PriceableThing = { id: string; code: string; title: string; kind: ProductOfferKind };

async function priceableThings(): Promise<PriceableThing[]> {
  const { data, error } = await adminClient()
    .from("experiences")
    .select("id, slug, title, kind")
    .in("kind", [...PRICEABLE_KINDS]);
  if (error) throw new AccessError(error.message, 500);
  return ((data ?? []) as { id: string; slug: string; title: string | null; kind: string }[])
    .map((row) => ({
      id: row.id,
      code: row.slug,
      title: row.title ?? row.slug,
      // A physical product is bought; a consultation or package is agreed in
      // conversation first. The owner can still price either way.
      kind: (row.kind === "physical" ? "checkout" : "lead") as ProductOfferKind,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

async function priceableThing(code: string): Promise<PriceableThing> {
  const known = (await priceableThings()).find((thing) => thing.code === code);
  if (!known) throw new AccessError("product_unknown", 404);
  return known;
}

export async function listProductOffers(): Promise<ProductOfferRow[]> {
  const things = await priceableThings();
  const { data, error } = await adminClient()
    .from("experience_offers")
    .select(COLUMNS)
    .in(
      "code",
      things.map((thing) => thing.code),
    );
  if (error) throw new AccessError(error.message, 500);

  const byCode = new Map(
    (data ?? []).map((row) => {
      const offer = fromRow(row as Record<string, unknown>);
      return [offer.code, offer];
    }),
  );

  /* Driven by the registry, not by the table of prices: a thing with no price
       yet has to appear on the screen, or the owner cannot give it its first. */
  return things.map((thing) => ({
    code: thing.code,
    title: thing.title,
    expectedKind: thing.kind,
    offer: byCode.get(thing.code) ?? null,
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
  const thing = await priceableThing(input.code);

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

  /* Written to the one table of prices (2026-09-25), against the thing it
     prices. A missing figure is stored as a lead: a checkout without an amount
     has never opened. */
  const { data, error } = await adminClient()
    .from("experience_offers")
    .upsert(
      {
        experience_id: thing.id,
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
  await priceableThing(code);

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
