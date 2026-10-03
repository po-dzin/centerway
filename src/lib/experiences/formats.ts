import "server-only";

import { unstable_cache } from "next/cache";

import { currentPrice, type CurrentPrice } from "@/lib/experiences/earlyPrice";
import { COURSE_LIST_TAG, courseTag, getLiveCourse } from "@/lib/lms/liveCatalog";
import { toOfferSurface } from "@/lib/platform/courseOffer";
import type { OfferSurface } from "@/lib/platform/offerSurface";
import { courseOfferCode } from "@/lms-core";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * FORMATS: ONE PROGRAM, SEVERAL WAYS THROUGH IT (2026-09-25).
 *
 * An offer with a `format` is one way to take its program — on your own, in a
 * cohort, with a guide. A format may open more than its program
 * (`experience_offer_items`): the Шлях 21 cohort also opens Reset Day and
 * Short. This module is the one reader of that shape for the storefront and
 * for the storefront; the checkout reads the same rows through `describeOffer`,
 * so the page cannot advertise a format the checkout refuses.
 *
 * ONLY APPROVED AND ACTIVE. An author's proposal (`review_status` draft /
 * proposed / declined) never reaches a buyer: the database refuses `active` on
 * anything not approved, and every read here asks for both anyway.
 */

export const OFFER_FORMATS = ["self", "group", "individual"] as const;
export type OfferFormat = (typeof OFFER_FORMATS)[number];

export function isOfferFormat(value: unknown): value is OfferFormat {
  return typeof value === "string" && (OFFER_FORMATS as readonly string[]).includes(value);
}

/** The name a format goes by when its author has not named it. */
export const FORMAT_DEFAULT_LABELS: Record<OfferFormat, string> = {
  self: "Самостійно",
  group: "У групі потоку",
  individual: "Індивідуальний супровід",
};

export type FormatIncludedProgram = {
  courseSlug: string;
  programSlug: string;
  title: string;
  kind: "course" | "mini" | "checklist" | null;
  /** The card's badge and length, «Міні-курс» and «7 днів» — the same words its own card prints. */
  tag?: string | null;
  duration?: string | null;
  /** The program's cover, for the row's thumbnail. */
  cover?: string | null;
  /** What the program costs on its own, now; null when it is not sold separately. */
  separateAmount?: number | null;
  currency?: string;
};

export type ProgramFormat = {
  code: string;
  format: OfferFormat;
  label: string;
  summary: string | null;
  /** What the buyer gets in this format, point by point, in the author's words. Empty when not written yet. */
  features: string[];
  mode: "checkout" | "lead" | "free";
  /** Whole currency units, the price NOW (the early one while it holds). `null` only on a lead: «ціна за запитом». */
  amount: number | null;
  listAmount: number | null;
  /** The early price window while it holds: «До 15 жовтня 3 400 ₴, далі 4 100 ₴» and the timer. */
  early: CurrentPrice["early"];
  /** The stored early price, read raw so the cached rows can be priced at the moment of the request. */
  earlyAmount: number | null;
  earlyUntil: string | null;
  /** The stored price after the early window; what `amount` falls back to. */
  regularAmount: number | null;
  regularListAmount: number | null;
  currency: string;
  /** `YYYY-MM-DD`, day 1 of the cohort. Group formats only. */
  cohortStartsOn: string | null;
  /** The owner's «Бестселер» mark (builder): the gold pill and the row's only primary button. */
  featured: boolean;
  /** Other programs this format opens, in the order the author set. */
  includes: FormatIncludedProgram[];
};

type OfferRow = {
  id: string;
  experience_id: string;
  code: string;
  mode: string;
  amount: number | null;
  list_amount: number | null;
  early_amount: number | null;
  early_until: string | null;
  currency: string;
  format: string | null;
  label: unknown;
  summary: unknown;
  features: unknown;
  sort_order: number;
  cohort_starts_on: string | null;
  featured: boolean | null;
};

const OFFER_COLUMNS =
  "id, experience_id, code, mode, amount, list_amount, early_amount, early_until, currency, format, label, summary, features, sort_order, cohort_starts_on, featured";

function ukLine(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const uk = (value as { uk?: unknown }).uk;
  return typeof uk === "string" && uk.trim() ? uk.trim() : null;
}

/** The `uk` list of a `{uk: [..], en: [..]}` column, blanks dropped. */
export function ukList(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const uk = (value as { uk?: unknown }).uk;
  if (!Array.isArray(uk)) return [];
  return uk
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

type Db = ReturnType<typeof supabaseAdmin>;

async function includedPrograms(db: Db, offerIds: string[]): Promise<Map<string, FormatIncludedProgram[]>> {
  const byOffer = new Map<string, FormatIncludedProgram[]>();
  if (offerIds.length === 0) return byOffer;

  const items = await db
    .from("experience_offer_items")
    .select("offer_id, experience_id, sort_order")
    .in("offer_id", offerIds);
  if (items.error || !items.data || items.data.length === 0) return byOffer;

  const experienceIds = [...new Set(items.data.map((row) => row.experience_id as string))];
  const courses = await db
    .from("lms_courses")
    .select("slug, program_slug, title, kind, status, experience_id")
    .in("experience_id", experienceIds)
    .eq("status", "published");
  if (courses.error || !courses.data) return byOffer;
  const courseByExperience = new Map(courses.data.map((row) => [row.experience_id as string, row]));

  // What each bonus is and costs on its own, in the words its own card uses.
  const surfaces = new Map(
    await Promise.all(
      courses.data.map(async (row) => {
        const live = await getLiveCourse(row.slug as string).catch(() => null);
        return [row.slug as string, live ? toOfferSurface(live) : null] as const;
      }),
    ),
  );
  const ownOffers = await db
    .from("experience_offers")
    .select("code, amount, list_amount, early_amount, early_until, currency, mode")
    .in(
      "code",
      courses.data.map((row) => courseOfferCode(row.slug as string)),
    )
    .eq("active", true)
    .eq("review_status", "approved");
  const offerByCode = new Map((ownOffers.data ?? []).map((row) => [row.code as string, row]));

  const sorted = [...items.data].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  for (const item of sorted) {
    const course = courseByExperience.get(item.experience_id as string);
    // An included program that is not published is not advertised: the buyer
    // would be promised something that does not open.
    if (!course) continue;
    const list = byOffer.get(item.offer_id as string) ?? [];
    list.push({
      courseSlug: course.slug as string,
      programSlug: (course.program_slug as string | null) ?? (course.slug as string),
      title: course.title as string,
      kind: (course.kind as FormatIncludedProgram["kind"]) ?? null,
      ...separately(
        surfaces.get(course.slug as string) ?? null,
        offerByCode.get(courseOfferCode(course.slug as string)),
      ),
    });
    byOffer.set(item.offer_id as string, list);
  }
  return byOffer;
}

type OwnOffer = {
  amount: number | null;
  list_amount: number | null;
  early_amount: number | null;
  early_until: string | null;
  currency: string;
  mode: string;
};

function separately(
  surface: OfferSurface | null,
  offer: OwnOffer | undefined,
): Pick<FormatIncludedProgram, "tag" | "duration" | "cover" | "separateAmount" | "currency"> {
  const price =
    offer && offer.mode === "checkout"
      ? currentPrice({
          amount: offer.amount,
          listAmount: offer.list_amount,
          earlyAmount: offer.early_amount,
          earlyUntil: offer.early_until,
        }).amount
      : null;
  return {
    tag: surface?.tag ?? null,
    duration: surface?.duration ?? null,
    cover: surface?.artwork?.desktop ?? null,
    separateAmount: price !== null && price > 0 ? price : null,
    currency: offer?.currency ?? "UAH",
  };
}

function toFormat(row: OfferRow, includes: FormatIncludedProgram[], ownCode: string): ProgramFormat | null {
  // The course's own offer is its self-paced format whether or not anyone
  // marked it so — it is the thing that was on sale before formats existed.
  const kind = isOfferFormat(row.format) ? row.format : row.code === ownCode ? "self" : null;
  if (!kind) return null;
  const mode = row.mode === "lead" || row.mode === "free" ? row.mode : "checkout";
  if (mode === "checkout" && (row.amount === null || row.amount <= 0)) return null;
  return {
    code: row.code,
    format: kind,
    label: ukLine(row.label) ?? FORMAT_DEFAULT_LABELS[kind],
    summary: ukLine(row.summary),
    features: ukList(row.features),
    mode,
    amount: row.amount,
    listAmount: row.list_amount,
    early: null,
    earlyAmount: row.early_amount ?? null,
    earlyUntil: row.early_until ?? null,
    regularAmount: row.amount,
    regularListAmount: row.list_amount,
    currency: row.currency,
    cohortStartsOn: row.cohort_starts_on,
    featured: row.featured === true,
    includes,
  };
}

async function readProgramFormats(courseId: string, courseSlug: string): Promise<ProgramFormat[]> {
  try {
    const db = supabaseAdmin();
    const course = await db.from("lms_courses").select("experience_id").eq("id", courseId).maybeSingle();
    const experienceId = course.data?.experience_id as string | null | undefined;
    if (course.error || !experienceId) return [];

    const offers = await db
      .from("experience_offers")
      .select(OFFER_COLUMNS)
      .eq("experience_id", experienceId)
      .eq("active", true)
      .eq("review_status", "approved");
    if (offers.error || !offers.data) return [];

    const ownCode = courseOfferCode(courseSlug);
    const rows = (offers.data as OfferRow[])
      .filter((row) => row.format !== null || row.code === ownCode)
      .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    const includes = await includedPrograms(
      db,
      rows.map((row) => row.id),
    );
    return rows
      .map((row) => toFormat(row, includes.get(row.id) ?? [], ownCode))
      .filter((entry): entry is ProgramFormat => entry !== null);
  } catch {
    // Formats that cannot be read are not «no formats»: the page falls back to
    // the single offer it always had, which is still for sale.
    return [];
  }
}

/**
 * The formats a program is sold in, cheapest-first within the author's order.
 * Empty for a program that has none — the page then shows its one offer as
 * before.
 */
export async function loadProgramFormats(
  course: { id: string; slug: string },
  now: Date = new Date(),
): Promise<ProgramFormat[]> {
  const formats = await unstable_cache(
    () => readProgramFormats(course.id, course.slug),
    ["program-formats", course.id],
    {
      tags: [courseTag(course.slug), COURSE_LIST_TAG],
      revalidate: 300,
    },
  )();
  // Priced here, outside the cache: the early price ends at a moment, and a
  // cached row must not keep quoting it for five more minutes.
  return formats.map((format) => priceFormat(format, now));
}

/** A format priced at `now`: the early price while it holds, the regular one after. */
export function priceFormat(format: ProgramFormat, now: Date = new Date()): ProgramFormat {
  const price = currentPrice(
    {
      amount: format.regularAmount,
      listAmount: format.regularListAmount,
      earlyAmount: format.earlyAmount,
      earlyUntil: format.earlyUntil,
    },
    now,
  );
  return { ...format, amount: price.amount, listAmount: price.listAmount, early: price.early };
}

/** A format of ANOTHER program that opens this one as a bonus. */
export type BundleHost = {
  code: string;
  label: string;
  /** The program whose format it is — Шлях 21 for Reset Day. */
  programSlug: string;
  programTitle: string;
};

/* Throws on a failed read, so the cache below never keeps a failure. */
async function readBundleHosts(courseSlug: string): Promise<BundleHost[]> {
  {
    const db = supabaseAdmin();
    const course = await db.from("lms_courses").select("experience_id").eq("slug", courseSlug).maybeSingle();
    const experienceId = course.data?.experience_id as string | null | undefined;
    if (course.error) throw new Error(`bundle_hosts_read_failed:${course.error.message}`);
    if (!experienceId) return [];

    const items = await db.from("experience_offer_items").select("offer_id").eq("experience_id", experienceId);
    if (items.error) throw new Error(`bundle_hosts_read_failed:${items.error.message}`);
    const offerIds = [...new Set((items.data ?? []).map((row) => row.offer_id as string))];
    if (offerIds.length === 0) return [];

    const offers = await db
      .from("experience_offers")
      .select(OFFER_COLUMNS)
      .in("id", offerIds)
      .eq("active", true)
      .eq("review_status", "approved");
    if (offers.error) throw new Error(`bundle_hosts_read_failed:${offers.error.message}`);
    const rows = ((offers.data ?? []) as OfferRow[]).filter((row) => isOfferFormat(row.format));
    if (rows.length === 0) return [];

    const hosts = await db
      .from("lms_courses")
      .select("slug, program_slug, title, experience_id, status")
      .in("experience_id", [...new Set(rows.map((row) => row.experience_id))])
      .eq("status", "published");
    if (hosts.error) throw new Error(`bundle_hosts_read_failed:${hosts.error.message}`);
    const hostByExperience = new Map((hosts.data ?? []).map((row) => [row.experience_id as string, row]));

    return rows
      .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
      .flatMap((row): BundleHost[] => {
        const host = hostByExperience.get(row.experience_id);
        // A bonus of a program that is not published is not advertised.
        if (!host || !isOfferFormat(row.format)) return [];
        return [
          {
            code: row.code,
            label: ukLine(row.label) ?? FORMAT_DEFAULT_LABELS[row.format],
            programSlug: (host.program_slug as string | null) ?? (host.slug as string),
            // The short name the landings use: «Шлях 21», not the catalogue subtitle.
            programTitle: (host.title as string).split(" — ")[0]!.trim(),
          },
        ];
      });
  }
}

/**
 * The formats of other programs that open this course as a bonus — «Reset Day
 * comes with Шлях 21 in the group and the guided format». For the included
 * program's own landing, so it says where else it can be had.
 *
 * `null` means the read failed: the caller leaves whatever the page typed.
 * `[]` means it is in no bundle today.
 */
export async function loadBundleHosts(courseSlug: string): Promise<BundleHost[] | null> {
  try {
    return await unstable_cache(() => readBundleHosts(courseSlug), ["bundle-hosts", courseSlug], {
      tags: [courseTag(courseSlug), COURSE_LIST_TAG],
      revalidate: 300,
    })();
  } catch (error) {
    console.warn("bundle_hosts_read_failed", {
      courseSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
