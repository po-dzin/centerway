import "server-only";

import { unstable_cache } from "next/cache";

import { COURSE_LIST_TAG, courseTag } from "@/lib/lms/liveCatalog";
import { courseOfferCode } from "@/lms-core";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { normalizeOfferCode } from "./offers";

/**
 * FORMATS: ONE PROGRAM, SEVERAL WAYS THROUGH IT (2026-09-25).
 *
 * An offer with a `format` is one way to take its program — on your own, in a
 * cohort, with a guide. A format may open more than its program
 * (`experience_offer_items`): the Шлях 21 cohort also opens Reset Day and
 * Short. This module is the one reader of that shape for the storefront and
 * for the checkout, so the page cannot advertise a format the checkout refuses.
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
};

export type ProgramFormat = {
  code: string;
  format: OfferFormat;
  label: string;
  summary: string | null;
  /** What the buyer gets in this format, point by point, in the author's words. Empty when not written yet. */
  features: string[];
  mode: "checkout" | "lead" | "free";
  /** Whole currency units. `null` only on a lead: «ціна за запитом». */
  amount: number | null;
  listAmount: number | null;
  currency: string;
  /** `YYYY-MM-DD`, day 1 of the cohort. Group formats only. */
  cohortStartsOn: string | null;
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
  currency: string;
  format: string | null;
  label: unknown;
  summary: unknown;
  features: unknown;
  sort_order: number;
  cohort_starts_on: string | null;
};

const OFFER_COLUMNS =
  "id, experience_id, code, mode, amount, list_amount, currency, format, label, summary, features, sort_order, cohort_starts_on";

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
    });
    byOffer.set(item.offer_id as string, list);
  }
  return byOffer;
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
    currency: row.currency,
    cohortStartsOn: row.cohort_starts_on,
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
export async function loadProgramFormats(course: { id: string; slug: string }): Promise<ProgramFormat[]> {
  return unstable_cache(() => readProgramFormats(course.id, course.slug), ["program-formats", course.id], {
    tags: [courseTag(course.slug), COURSE_LIST_TAG],
    revalidate: 300,
  })();
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

export type PayableFormat = {
  code: string;
  mode: "checkout" | "lead";
  amount: number | null;
  listAmount: number | null;
  currency: string;
  pixelContentName: string | null;
  invoiceHeading: { uk: string; en: string } | null;
  invoiceDescription: { uk: string; en: string } | null;
  format: OfferFormat;
  label: string;
  courseSlug: string;
  programSlug: string;
  courseTitle: string;
  courseStatus: string;
  courseVisibility: string | null;
};

function localizedPair(value: unknown): { uk: string; en: string } | null {
  const uk = ukLine(value);
  if (!uk) return null;
  const en = (value as { en?: unknown }).en;
  return { uk, en: typeof en === "string" && en.trim() ? en : uk };
}

/**
 * A format by its checkout code, for the two doors that take money or a lead
 * (`/api/pay/start`, `/api/orders/create`, `/api/leads`). Uncached: price is
 * read at the moment it is charged.
 *
 * `null` for anything that is not an approved, active format of a program —
 * an unknown code is a 404 at the door, never someone else's product.
 */
export async function resolveFormatOffer(code: unknown): Promise<PayableFormat | null> {
  const key = normalizeOfferCode(code);
  if (!key) return null;
  try {
    const db = supabaseAdmin();
    const offer = await db
      .from("experience_offers")
      .select(
        "code, mode, amount, list_amount, currency, pixel_content_name, invoice_heading, invoice_description, format, label, experience_id, active, review_status",
      )
      .eq("code", key)
      .maybeSingle();
    const row = offer.data;
    if (offer.error || !row || !row.active || row.review_status !== "approved" || !isOfferFormat(row.format)) {
      return null;
    }
    if (row.mode !== "checkout" && row.mode !== "lead") return null;

    const course = await db
      .from("lms_courses")
      .select("slug, program_slug, title, status, visibility")
      .eq("experience_id", row.experience_id as string)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (course.error || !course.data) return null;

    return {
      code: row.code as string,
      mode: row.mode,
      amount: row.amount as number | null,
      listAmount: row.list_amount as number | null,
      currency: row.currency as string,
      pixelContentName: row.pixel_content_name as string | null,
      invoiceHeading: localizedPair(row.invoice_heading),
      invoiceDescription: localizedPair(row.invoice_description),
      format: row.format,
      label: ukLine(row.label) ?? FORMAT_DEFAULT_LABELS[row.format],
      courseSlug: course.data.slug as string,
      programSlug: (course.data.program_slug as string | null) ?? (course.data.slug as string),
      courseTitle: course.data.title as string,
      courseStatus: course.data.status as string,
      courseVisibility: course.data.visibility as string | null,
    };
  } catch {
    return null;
  }
}

/**
 * What a format code belongs to, for a buyer coming BACK from paying for it.
 *
 * Unlike `resolveFormatOffer` this does not ask whether the format is still on
 * sale: the purchase was real when it was made, and a group withdrawn an hour
 * after someone paid for it must still return that person to its program — not
 * to whatever the return route falls back to.
 */
export async function describeFormatCode(code: unknown): Promise<{ code: string; programSlug: string } | null> {
  const key = normalizeOfferCode(code);
  if (!key) return null;
  try {
    const db = supabaseAdmin();
    const offer = await db
      .from("experience_offers")
      .select("code, format, experience_id")
      .eq("code", key)
      .maybeSingle();
    if (offer.error || !offer.data || !isOfferFormat(offer.data.format)) return null;
    const course = await db
      .from("lms_courses")
      .select("slug, program_slug")
      .eq("experience_id", offer.data.experience_id as string)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (course.error || !course.data) return null;
    return {
      code: offer.data.code as string,
      programSlug: (course.data.program_slug as string | null) ?? (course.data.slug as string),
    };
  } catch {
    return null;
  }
}
