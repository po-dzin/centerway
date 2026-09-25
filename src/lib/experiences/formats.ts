import "server-only";

import { unstable_cache } from "next/cache";

import { COURSE_LIST_TAG, courseTag } from "@/lib/lms/liveCatalog";
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
