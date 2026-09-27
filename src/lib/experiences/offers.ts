import type { adminClient } from "@/lib/auth/adminClient";
import type { ProductFulfilment } from "@/lib/products";
import { parseCourseOfferCode } from "@/lms-core/offerCode";

import { isContentKind, type ExperienceKind } from "./registry";

/**
 * WHAT A THING COSTS, FROM ONE TABLE (2026-09-20).
 *
 * `experience_offers` replaces three stores of price — `lms_course_offers`,
 * `product_offers` and the constants in `PRODUCTS`. An offer belongs to a thing
 * in the registry, a thing may have SEVERAL (self-paced and guided, early and
 * regular), and an offer may open more than its own thing
 * (`experience_offer_items`: the guided package opens the way21 course).
 *
 * THE ONLY PLACE A PRICE IS WRITTEN (2026-09-25). The owner's catalogue, the
 * product prices, the builder's access term and the format review all write
 * here; the copies from the two older tables are gone
 * (`20260925010000_offer_writers_move.sql`), and those tables are an archive.
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
  /** `self` | `group` | `individual` for a format of a program; `null` for a thing sold one way. */
  format: string | null;
  /** The name the author gave the format, Ukrainian line only. */
  label: string | null;
};

const COLUMNS =
  "id, experience_id, code, mode, amount, list_amount, currency, access_days, access_lifetime, invoice_heading, invoice_description, share_pct, pixel_content_name, active, format, label";

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
  format: string | null;
  label: unknown;
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
    format: row.format,
    label: localized(row.label)?.uk ?? null,
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

/**
 * An offer together with what it sells and who delivers it.
 *
 * THE ONE CHANNEL FROM A CODE TO A THING (2026-09-25). Every door that is
 * handed a product code — the checkout, the lead form, the return from the
 * gateway, the operator's access link, the Meta job — asks this, and this asks
 * `resolveOffer`, which asks `offer_aliases`. Before it, each door kept its own
 * table of old spellings (`normalizeProduct`, `COURSE_CODE_ALIASES`, the
 * `irem_` prefix check), and they disagreed at the edges: `mini-detox` was an
 * alias in the database and unknown to the checkout.
 *
 * `course` is the row that delivers a content kind. Its slug is read from the
 * offer's own code when the code is `course:<slug>` — a program has one row
 * per language under one thing, and the code names the one that was sold —
 * otherwise the thing's first course.
 */
export type OfferTarget = {
  offer: ExperienceOffer;
  via: ResolvedOffer["via"];
  experience: { id: string; kind: ExperienceKind; slug: string; title: string | null };
  course: { slug: string; programSlug: string } | null;
};

export async function describeOffer(db: Db, code: unknown): Promise<OfferTarget | null> {
  const resolved = await resolveOffer(db, code);
  if (!resolved) return null;
  const { offer, via } = resolved;

  const thing = await db.from("experiences").select("id, kind, slug, title").eq("id", offer.experienceId).maybeSingle();
  if (thing.error) throw new Error(`experience_read_failed:${thing.error.message}`);
  if (!thing.data) return null;
  const experience = {
    id: thing.data.id as string,
    kind: thing.data.kind as ExperienceKind,
    slug: thing.data.slug as string,
    title: (thing.data.title as string | null) ?? null,
  };

  if (!isContentKind(experience.kind)) return { offer, via, experience, course: null };

  const ownSlug = parseCourseOfferCode(offer.code);
  const courses = ownSlug
    ? await db.from("lms_courses").select("slug, program_slug").eq("slug", ownSlug).limit(1)
    : await db
        .from("lms_courses")
        .select("slug, program_slug")
        .eq("experience_id", experience.id)
        .order("created_at", { ascending: true })
        .limit(1);
  if (courses.error) throw new Error(`offer_course_read_failed:${courses.error.message}`);
  const row = (courses.data ?? [])[0] as { slug: string; program_slug: string | null } | undefined;
  const course = row ? { slug: row.slug, programSlug: row.program_slug ?? row.slug } : null;
  return { offer, via, experience, course };
}

/** Where a purchase of this offer is delivered: its course, or the cabinet that lists everything else. */
export function offerFulfilment(target: Pick<OfferTarget, "course">): ProductFulfilment {
  return target.course
    ? { kind: "course", courseSlug: target.course.slug, programSlug: target.course.programSlug }
    : { kind: "cabinet" };
}
