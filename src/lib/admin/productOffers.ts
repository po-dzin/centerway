/** Standalone services and products. A course format is priced under its
 * program in the catalogue, including former packages rebound to that program.
 * Readers may include support; only the admin API authorizes writes.
 */

import { AccessError } from "@/lib/admin/access";
import { adminClient } from "@/lib/auth/adminClient";
import { toProductOffer } from "@/lib/platform/productOffers";
import type { ProductOffer, ProductOfferKind, ProductOfferRow } from "@/lib/admin/productOfferTypes";

// From the one table of prices (2026-09-25); `mode` there is `kind` here,
// translated in `fromRow` rather than by a column alias.
const COLUMNS =
  "experience_id, format, code, amount, list_amount, currency, mode, pixel_content_name, active, updated_at";

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

async function registeredThings(): Promise<PriceableThing[]> {
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

async function priceableThings(): Promise<PriceableThing[]> {
  const things = await registeredThings();
  if (!things.length) return [];
  const { data, error } = await adminClient()
    .from("experience_offers")
    .select("code, experience_id, format")
    .in(
      "code",
      things.map((thing) => thing.code),
    );
  if (error) throw new AccessError(error.message, 500);
  const offers = new Map((data ?? []).map((row) => [row.code, row]));
  // A package alias can survive for historical orders after its offer has
  // become a course format. It must neither appear nor be writable here.
  return things.filter((thing) => {
    const offer = offers.get(thing.code);
    return !offer || (offer.format == null && (!offer.experience_id || offer.experience_id === thing.id));
  });
}

async function priceableThing(code: string): Promise<PriceableThing> {
  const known = (await priceableThings()).find((thing) => thing.code === code);
  if (!known) throw new AccessError("product_unknown", 404);
  const { data, error } = await adminClient()
    .from("experience_offers")
    .select("experience_id, format")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (data?.format != null && data.experience_id !== known.id) {
    throw new AccessError("product_is_course_format", 409);
  }
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
  return (
    things
      // A retired package may now be a course format (way21-support). It is
      // managed under that course in “Prices and access”, never in two tabs.
      // Standalone products, including ones without a price yet, remain here.
      .filter(
        (thing) =>
          !(data ?? []).some(
            (row) => row.code === thing.code && typeof row.format === "string" && row.experience_id !== thing.id,
          ),
      )
      .map((thing) => ({
        code: thing.code,
        title: thing.title,
        expectedKind: thing.kind,
        offer: byCode.get(thing.code) ?? null,
      }))
  );
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

  // Existing offers retain their registry identity. Formats are excluded by
  // priceableThing before either save or sale-switch writes reach this table.
  const db = adminClient();
  const existing = await db.from("experience_offers").select("experience_id").eq("code", input.code).maybeSingle();
  if (existing.error) throw new AccessError(existing.error.message, 500);
  const experienceId = (existing.data?.experience_id as string | undefined) ?? thing.id;

  const { data, error } = await db
    .from("experience_offers")
    .upsert(
      {
        experience_id: experienceId,
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
