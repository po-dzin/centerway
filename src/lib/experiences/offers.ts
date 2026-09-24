import type { adminClient } from "@/lib/auth/adminClient";

/**
 * WHAT A THING COSTS, FROM ONE TABLE (2026-09-20).
 *
 * `experience_offers` replaces three stores of price — `lms_course_offers`,
 * `product_offers` and the constants in `PRODUCTS`. An offer belongs to a thing
 * in the registry, a thing may have SEVERAL (self-paced and guided, early and
 * regular), and an offer may open more than its own thing
 * (`experience_offer_items`: the guided package opens the way21 course).
 *
 * TRANSITIONAL: the owner's catalogue and the builder's access term still write
 * the two old tables, and database triggers mirror every such write here by
 * `code`. So this module is safe to READ today and must not be WRITTEN until the
 * catalogue moves — a write here would be overwritten by the next mirror.
 * See the migration `20260924020000_experience_offers.sql`.
 */

type Db = ReturnType<typeof adminClient>;

export const OFFER_MODES = ["checkout", "lead", "free"] as const;
export type OfferMode = (typeof OFFER_MODES)[number];

export type LocalizedLine = { uk: string; en: string };

export type ExperienceOffer = {
  id: string;
  experienceId: string;
  code: string;
  mode: OfferMode;
  /** Whole currency units. `null` is «ціна за запитом» and only ever on a lead offer; 0 only on a free one. */
  amount: number | null;
  listAmount: number | null;
  currency: string;
  accessDays: number | null;
  accessLifetime: boolean;
  /** The gateway's invoice line. `null`: build it from the course's own title. */
  invoiceHeading: LocalizedLine | null;
  invoiceDescription: LocalizedLine | null;
  /** The author's share for this offer, percent. `null`: the author's default. */
  sharePct: number | null;
  pixelContentName: string | null;
  active: boolean;
};

const COLUMNS =
  "id, experience_id, code, mode, amount, list_amount, currency, access_days, access_lifetime, invoice_heading, invoice_description, share_pct, pixel_content_name, active";

type OfferRow = {
  id: string;
  experience_id: string;
  code: string;
  mode: string;
  amount: number | null;
  list_amount: number | null;
  currency: string;
  access_days: number | null;
  access_lifetime: boolean;
  invoice_heading: unknown;
  invoice_description: unknown;
  share_pct: number | string | null;
  pixel_content_name: string | null;
  active: boolean;
};

function localized(value: unknown): LocalizedLine | null {
  if (!value || typeof value !== "object") return null;
  const { uk, en } = value as { uk?: unknown; en?: unknown };
  if (typeof uk !== "string" || !uk.trim()) return null;
  // One language is a legitimate state — a course written by its author has one
  // — and the gateway still needs a line in both slots.
  return { uk, en: typeof en === "string" && en.trim() ? en : uk };
}

function fromRow(row: OfferRow): ExperienceOffer {
  return {
    id: row.id,
    experienceId: row.experience_id,
    code: row.code,
    mode: row.mode as OfferMode,
    amount: row.amount,
    listAmount: row.list_amount,
    currency: row.currency,
    accessDays: row.access_days,
    accessLifetime: row.access_lifetime,
    invoiceHeading: localized(row.invoice_heading),
    invoiceDescription: localized(row.invoice_description),
    sharePct: row.share_pct === null ? null : Number(row.share_pct),
    pixelContentName: row.pixel_content_name,
    active: row.active,
  };
}

/** Codes are stored lowercase; `Course:Way21` typed into a URL is the same offer. */
export function normalizeOfferCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const key = code.trim().toLowerCase();
  return key ? key : null;
}

export type ResolvedOffer = { offer: ExperienceOffer; via: "code" | "alias" };

/**
 * Finds an offer by its code or by any code it was ever sold or granted under.
 *
 * The live code wins over an alias, for the same reason a live address wins in
 * the registry. Returns inactive offers too and says so in `active`: a caller
 * opening a checkout must refuse them, a caller explaining an old ORDER must
 * not — the order was real when it was placed.
 */
export async function resolveOffer(db: Db, code: unknown): Promise<ResolvedOffer | null> {
  const key = normalizeOfferCode(code);
  if (!key) return null;

  const direct = await db.from("experience_offers").select(COLUMNS).eq("code", key).maybeSingle();
  if (direct.error) throw new Error(`offer_read_failed:${direct.error.message}`);
  if (direct.data) return { offer: fromRow(direct.data as OfferRow), via: "code" };

  const alias = await db.from("offer_aliases").select("offer_id").eq("code", key).maybeSingle();
  if (alias.error) throw new Error(`offer_alias_read_failed:${alias.error.message}`);
  if (!alias.data) return null;

  const aliased = await db.from("experience_offers").select(COLUMNS).eq("id", alias.data.offer_id).maybeSingle();
  if (aliased.error) throw new Error(`offer_read_failed:${aliased.error.message}`);
  return aliased.data ? { offer: fromRow(aliased.data as OfferRow), via: "alias" } : null;
}

/** Every active offer of one thing, cheapest first; «за запитом» last, since it has no figure to order by. */
export async function listOffersOf(db: Db, experienceId: string): Promise<ExperienceOffer[]> {
  const { data, error } = await db
    .from("experience_offers")
    .select(COLUMNS)
    .eq("experience_id", experienceId)
    .eq("active", true);
  if (error) throw new Error(`offers_read_failed:${error.message}`);
  return ((data ?? []) as OfferRow[])
    .map(fromRow)
    .sort(
      (a, b) =>
        (a.amount ?? Number.POSITIVE_INFINITY) - (b.amount ?? Number.POSITIVE_INFINITY) || a.code.localeCompare(b.code),
    );
}

/**
 * Every thing an offer opens: its own, plus whatever `experience_offer_items`
 * adds. The guided package answers [way21-support, way21] — which is what lets a
 * package buyer into the course without the course carrying the package's code.
 */
export async function experiencesOpenedBy(
  db: Db,
  offer: Pick<ExperienceOffer, "id" | "experienceId">,
): Promise<string[]> {
  const { data, error } = await db.from("experience_offer_items").select("experience_id").eq("offer_id", offer.id);
  if (error) throw new Error(`offer_items_read_failed:${error.message}`);
  const extra = ((data ?? []) as { experience_id: string }[]).map((row) => row.experience_id);
  return [...new Set([offer.experienceId, ...extra])];
}

/** Whether a checkout may be opened for this offer right now. */
export function isPayable(offer: ExperienceOffer): offer is ExperienceOffer & { amount: number } {
  return offer.active && offer.mode === "checkout" && offer.amount !== null && offer.amount > 0;
}
