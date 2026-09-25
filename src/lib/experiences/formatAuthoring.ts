import "server-only";

import { adminClient } from "@/lib/auth/adminClient";
import type { TablesUpdate } from "@/lib/db/database.types";
import { courseOfferCode } from "@/lms-core";

import { FORMAT_DEFAULT_LABELS, isOfferFormat, type OfferFormat } from "./formats";

/**
 * THE FORMAT CONSTRUCTOR, AUTHOR SIDE AND OWNER SIDE (2026-09-25).
 *
 * The creator contract (2026-08-22) says the owner sets prices. The constructor
 * keeps that and still lets the author work: the author composes a format — its
 * kind, name, what it gives, which of THEIR OWN programs it opens — and PROPOSES
 * a price. The proposal sits in `proposed_amount`; the live `amount` is written
 * only by the owner, at approval, and may differ from what was proposed.
 *
 * WHAT AN AUTHOR MAY TOUCH
 *   · a draft / proposed / declined format: everything, and may withdraw it;
 *   · an approved one: its name and description, and a NEW price proposal.
 *     Not what it opens and not its start date — those change what people who
 *     already paid are owed, and are the owner's to change.
 * An admin editing from the builder is the owner and has no such limits.
 *
 * Every write goes through the service role on the server: RLS on
 * `experience_offers` is admin-only, and this module is where the narrower
 * author rules live.
 */

type Db = ReturnType<typeof adminClient>;

export const FORMAT_LABEL_MAX = 60;
export const FORMAT_SUMMARY_MAX = 240;
export const FORMAT_AMOUNT_MAX = 1_000_000;

export type FormatReviewStatus = "draft" | "proposed" | "approved" | "declined";

export type AuthoredFormat = {
  code: string;
  format: OfferFormat;
  label: string;
  /** Whether `label` is the author's own words or the default for the kind. */
  labelIsDefault: boolean;
  summary: string;
  mode: "checkout" | "lead";
  amount: number | null;
  proposedAmount: number | null;
  currency: string;
  cohortStartsOn: string | null;
  reviewStatus: FormatReviewStatus;
  active: boolean;
  includes: Array<{ slug: string; title: string }>;
};

export type IncludableProgram = { slug: string; title: string; status: string };

export type FormatInput = {
  format?: unknown;
  label?: unknown;
  summary?: unknown;
  mode?: unknown;
  proposedAmount?: unknown;
  cohortStartsOn?: unknown;
  includes?: unknown;
  submit?: unknown;
};

export class FormatError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}

const COLUMNS =
  "id, code, format, label, summary, mode, amount, proposed_amount, currency, cohort_starts_on, review_status, active, sort_order, experience_id";

type Row = {
  id: string;
  code: string;
  format: string | null;
  label: unknown;
  summary: unknown;
  mode: string;
  amount: number | null;
  proposed_amount: number | null;
  currency: string;
  cohort_starts_on: string | null;
  review_status: string;
  active: boolean;
  sort_order: number;
  experience_id: string;
};

function uk(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const text = (value as { uk?: unknown }).uk;
  return typeof text === "string" ? text : "";
}

async function courseRow(db: Db, courseId: string) {
  const { data, error } = await db
    .from("lms_courses")
    .select("id, slug, program_slug, author_id, experience_id")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw new FormatError(`format_course_read_failed:${error.message}`, 500);
  if (!data?.experience_id) throw new FormatError("format_course_not_registered", 409);
  return data as {
    id: string;
    slug: string;
    program_slug: string | null;
    author_id: string | null;
    experience_id: string;
  };
}

export async function listCourseFormats(courseId: string): Promise<AuthoredFormat[]> {
  const db = adminClient();
  const course = await courseRow(db, courseId);

  const { data, error } = await db.from("experience_offers").select(COLUMNS).eq("experience_id", course.experience_id);
  if (error) throw new FormatError(`format_read_failed:${error.message}`, 500);
  // The course's own offer counts as its self-paced format even before anyone
  // marked it so: it is the thing already on sale. Filtered here, not in an
  // `.or()` — a `:` in the value is exactly the kind PostgREST drops silently.
  const ownCode = courseOfferCode(course.slug);
  const rows = ((data ?? []) as Row[]).filter((row) => row.format !== null || row.code === ownCode);

  const ids = rows.map((row) => row.id);
  const { data: items } = ids.length
    ? await db.from("experience_offer_items").select("offer_id, experience_id, sort_order").in("offer_id", ids)
    : { data: [] as Array<{ offer_id: string; experience_id: string; sort_order: number }> };
  const itemExperienceIds = [...new Set((items ?? []).map((item) => item.experience_id as string))];
  const { data: itemCourses } = itemExperienceIds.length
    ? await db.from("lms_courses").select("slug, title, experience_id").in("experience_id", itemExperienceIds)
    : { data: [] as Array<{ slug: string; title: string; experience_id: string }> };
  const courseByExperience = new Map((itemCourses ?? []).map((row) => [row.experience_id as string, row]));

  return rows
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    .map((row): AuthoredFormat => {
      const format: OfferFormat = isOfferFormat(row.format) ? row.format : "self";
      const label = uk(row.label);
      return {
        code: row.code,
        format,
        label: label || FORMAT_DEFAULT_LABELS[format],
        labelIsDefault: !label,
        summary: uk(row.summary),
        mode: row.mode === "lead" ? "lead" : "checkout",
        amount: row.amount,
        proposedAmount: row.proposed_amount,
        currency: row.currency,
        cohortStartsOn: row.cohort_starts_on,
        reviewStatus: row.review_status as FormatReviewStatus,
        active: row.active,
        includes: [...(items ?? [])]
          .filter((item) => item.offer_id === row.id)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          .flatMap((item) => {
            const target = courseByExperience.get(item.experience_id as string);
            return target ? [{ slug: target.slug as string, title: target.title as string }] : [];
          }),
      };
    });
}

/**
 * The programs this identity may put inside a format: their own, never this
 * one. An admin may include any program.
 */
export async function listIncludablePrograms(input: {
  courseId: string;
  authUserId: string;
  isAdmin: boolean;
}): Promise<IncludableProgram[]> {
  const db = adminClient();
  let query = db.from("lms_courses").select("slug, title, status").neq("id", input.courseId);
  if (!input.isAdmin) query = query.eq("author_id", input.authUserId);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw new FormatError(`format_programs_read_failed:${error.message}`, 500);
  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    title: row.title as string,
    status: row.status as string,
  }));
}

type Parsed = {
  format?: OfferFormat;
  label?: string;
  summary?: string;
  mode?: "checkout" | "lead";
  proposedAmount?: number | null;
  cohortStartsOn?: string | null;
  includes?: string[];
  submit: boolean;
};

function parseInput(input: FormatInput): Parsed {
  const parsed: Parsed = { submit: input.submit === true };
  if (input.format !== undefined) {
    if (!isOfferFormat(input.format)) throw new FormatError("format_invalid_kind");
    parsed.format = input.format;
  }
  if (input.label !== undefined) {
    if (typeof input.label !== "string") throw new FormatError("format_invalid_label");
    const label = input.label.trim();
    if (label.length > FORMAT_LABEL_MAX) throw new FormatError("format_label_too_long");
    parsed.label = label;
  }
  if (input.summary !== undefined) {
    if (typeof input.summary !== "string") throw new FormatError("format_invalid_summary");
    const summary = input.summary.trim();
    if (summary.length > FORMAT_SUMMARY_MAX) throw new FormatError("format_summary_too_long");
    parsed.summary = summary;
  }
  if (input.mode !== undefined) {
    if (input.mode !== "checkout" && input.mode !== "lead") throw new FormatError("format_invalid_mode");
    parsed.mode = input.mode;
  }
  if (input.proposedAmount !== undefined) {
    if (input.proposedAmount === null) parsed.proposedAmount = null;
    else if (
      typeof input.proposedAmount === "number" &&
      Number.isInteger(input.proposedAmount) &&
      input.proposedAmount > 0 &&
      input.proposedAmount <= FORMAT_AMOUNT_MAX
    ) {
      parsed.proposedAmount = input.proposedAmount;
    } else throw new FormatError("format_invalid_amount");
  }
  if (input.cohortStartsOn !== undefined) {
    if (input.cohortStartsOn === null || input.cohortStartsOn === "") parsed.cohortStartsOn = null;
    else if (typeof input.cohortStartsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.cohortStartsOn)) {
      parsed.cohortStartsOn = input.cohortStartsOn;
    } else throw new FormatError("format_invalid_cohort_date");
  }
  if (input.includes !== undefined) {
    if (!Array.isArray(input.includes) || !input.includes.every((slug) => typeof slug === "string")) {
      throw new FormatError("format_invalid_includes");
    }
    parsed.includes = [...new Set(input.includes as string[])];
  }
  return parsed;
}

async function writeIncludes(db: Db, offerId: string, slugs: string[], allowed: IncludableProgram[]): Promise<void> {
  const allowedSlugs = new Set(allowed.map((program) => program.slug));
  const refused = slugs.filter((slug) => !allowedSlugs.has(slug));
  if (refused.length > 0) throw new FormatError("format_include_not_yours", 403);

  const { data: targets, error } = slugs.length
    ? await db.from("lms_courses").select("slug, experience_id").in("slug", slugs)
    : { data: [] as Array<{ slug: string; experience_id: string | null }>, error: null };
  if (error) throw new FormatError(`format_programs_read_failed:${error.message}`, 500);
  const experienceBySlug = new Map(
    (targets ?? []).map((row) => [row.slug as string, row.experience_id as string | null]),
  );

  await db.from("experience_offer_items").delete().eq("offer_id", offerId);
  const rows = slugs.flatMap((slug, index) => {
    const experienceId = experienceBySlug.get(slug);
    return experienceId ? [{ offer_id: offerId, experience_id: experienceId, sort_order: index + 1 }] : [];
  });
  if (rows.length > 0) {
    const insert = await db.from("experience_offer_items").insert(rows);
    if (insert.error) throw new FormatError(`format_includes_write_failed:${insert.error.message}`, 500);
  }
}

async function freeCode(db: Db, base: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [{ data: offer }, { data: alias }] = await Promise.all([
      db.from("experience_offers").select("id").eq("code", code).maybeSingle(),
      db.from("offer_aliases").select("code").eq("code", code).maybeSingle(),
    ]);
    if (!offer && !alias) return code;
  }
  throw new FormatError("format_code_exhausted", 409);
}

export async function createFormat(input: {
  courseId: string;
  authUserId: string;
  isAdmin: boolean;
  body: FormatInput;
}): Promise<string> {
  const db = adminClient();
  const course = await courseRow(db, input.courseId);
  const parsed = parseInput(input.body);
  if (!parsed.format) throw new FormatError("format_invalid_kind");
  const mode = parsed.mode ?? (parsed.format === "individual" ? "lead" : "checkout");
  const programSlug = course.program_slug ?? course.slug;
  const code = await freeCode(db, `${programSlug}-${parsed.format}`.toLowerCase());

  const { data: siblings } = await db
    .from("experience_offers")
    .select("sort_order")
    .eq("experience_id", course.experience_id);
  const sortOrder = Math.max(0, ...(siblings ?? []).map((row) => Number(row.sort_order) || 0)) + 1;

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("experience_offers")
    .insert({
      experience_id: course.experience_id,
      code,
      mode,
      amount: null,
      currency: "UAH",
      active: false,
      format: parsed.format,
      label: parsed.label ? { uk: parsed.label, en: parsed.label } : null,
      summary: parsed.summary ? { uk: parsed.summary, en: parsed.summary } : null,
      sort_order: sortOrder,
      cohort_starts_on: parsed.format === "group" ? (parsed.cohortStartsOn ?? null) : null,
      review_status: parsed.submit ? "proposed" : "draft",
      proposed_amount: parsed.proposedAmount ?? null,
      proposed_by: input.authUserId,
      proposed_at: parsed.submit ? now : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new FormatError(`format_write_failed:${error?.message ?? "unknown"}`, 500);

  if (parsed.includes?.length) {
    const allowed = await listIncludablePrograms(input);
    await writeIncludes(db, data.id as string, parsed.includes, allowed);
  }
  return code;
}

async function ownedFormat(db: Db, courseId: string, code: string): Promise<Row> {
  const course = await courseRow(db, courseId);
  const { data, error } = await db.from("experience_offers").select(COLUMNS).eq("code", code).maybeSingle();
  if (error) throw new FormatError(`format_read_failed:${error.message}`, 500);
  if (!data || (data as Row).experience_id !== course.experience_id) throw new FormatError("format_not_found", 404);
  return data as Row;
}

export async function updateFormat(input: {
  courseId: string;
  authUserId: string;
  isAdmin: boolean;
  code: string;
  body: FormatInput;
}): Promise<void> {
  const db = adminClient();
  const row = await ownedFormat(db, input.courseId, input.code);
  const parsed = parseInput(input.body);
  const approved = row.review_status === "approved";
  const lockedForAuthor = approved && !input.isAdmin;

  if (lockedForAuthor) {
    const touchesLocked =
      parsed.format !== undefined ||
      parsed.mode !== undefined ||
      parsed.cohortStartsOn !== undefined ||
      parsed.includes !== undefined;
    if (touchesLocked) throw new FormatError("format_approved_locked", 409);
  }

  const now = new Date().toISOString();
  const patch: TablesUpdate<"experience_offers"> = {};
  if (parsed.format !== undefined) patch.format = parsed.format;
  if (parsed.mode !== undefined) patch.mode = parsed.mode;
  if (parsed.label !== undefined) patch.label = parsed.label ? { uk: parsed.label, en: parsed.label } : null;
  if (parsed.summary !== undefined) patch.summary = parsed.summary ? { uk: parsed.summary, en: parsed.summary } : null;
  if (parsed.cohortStartsOn !== undefined) patch.cohort_starts_on = parsed.cohortStartsOn;
  if (parsed.proposedAmount !== undefined) {
    patch.proposed_amount = parsed.proposedAmount;
    patch.proposed_by = input.authUserId;
    patch.proposed_at = now;
  }
  // Submitting sends a draft (or a declined one, reworked) to the owner. An
  // approved format stays approved and on sale; its new price waits beside it.
  if (parsed.submit && !approved) {
    patch.review_status = "proposed";
    patch.proposed_by = input.authUserId;
    patch.proposed_at = now;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("experience_offers").update(patch).eq("id", row.id);
    if (error) throw new FormatError(`format_write_failed:${error.message}`, 500);
  }
  if (parsed.includes !== undefined) {
    const allowed = await listIncludablePrograms(input);
    await writeIncludes(db, row.id, parsed.includes, allowed);
  }
}

/** An author may withdraw what never went on sale; anything sold is the owner's to retire. */
export async function deleteFormat(input: { courseId: string; isAdmin: boolean; code: string }): Promise<void> {
  const db = adminClient();
  const row = await ownedFormat(db, input.courseId, input.code);
  if (row.review_status === "approved") throw new FormatError("format_approved_locked", 409);
  const { error } = await db.from("experience_offers").delete().eq("id", row.id);
  if (error) throw new FormatError(`format_write_failed:${error.message}`, 500);
}

/* ─────────────────────────────────────────
   OWNER SIDE
   ───────────────────────────────────────── */

export type FormatForReview = AuthoredFormat & { courseSlug: string; courseTitle: string };

/** Every format of every program, proposals first — the owner's review list. */
export async function listFormatsForReview(): Promise<FormatForReview[]> {
  const db = adminClient();
  const { data: courses, error } = await db
    .from("lms_courses")
    .select("id, slug, title, experience_id")
    .not("experience_id", "is", null);
  if (error) throw new FormatError(`format_read_failed:${error.message}`, 500);

  const { data: formatted } = await db.from("experience_offers").select("experience_id").not("format", "is", null);
  const withFormats = new Set((formatted ?? []).map((row) => row.experience_id as string));

  const lists = await Promise.all(
    (courses ?? [])
      .filter((course) => withFormats.has(course.experience_id as string))
      .map(async (course) =>
        (await listCourseFormats(course.id as string)).map((format) => ({
          ...format,
          courseSlug: course.slug as string,
          courseTitle: course.title as string,
        })),
      ),
  );
  const rank = (format: FormatForReview) =>
    format.reviewStatus === "proposed" || format.proposedAmount !== null ? 0 : format.reviewStatus === "draft" ? 2 : 1;
  return lists.flat().sort((a, b) => rank(a) - rank(b) || a.courseSlug.localeCompare(b.courseSlug));
}

export type ReviewAction =
  | { action: "approve"; amount: number | null; listAmount?: number | null }
  | { action: "decline" }
  | { action: "withdraw" }
  | { action: "resume" };

/**
 * The owner's decision. Approving sets the LIVE price — the author's proposal
 * is a starting point the owner may change — and puts the format on sale.
 *
 * Every price lives in `experience_offers` alone since 2026-09-25 — the
 * copies from the two older tables are gone — so this writes it there.
 */
export async function reviewFormat(input: { code: string; actorId: string; decision: ReviewAction }): Promise<void> {
  const db = adminClient();
  const { data, error } = await db.from("experience_offers").select(COLUMNS).eq("code", input.code).maybeSingle();
  if (error) throw new FormatError(`format_read_failed:${error.message}`, 500);
  if (!data) throw new FormatError("format_not_found", 404);
  const row = data as Row;
  const now = new Date().toISOString();

  if (input.decision.action === "approve") {
    const amount = input.decision.amount;
    if (row.mode === "checkout" && (amount === null || !Number.isInteger(amount) || amount <= 0)) {
      throw new FormatError("format_invalid_amount");
    }
    if (amount !== null && (!Number.isInteger(amount) || amount <= 0 || amount > FORMAT_AMOUNT_MAX)) {
      throw new FormatError("format_invalid_amount");
    }
    const listAmount = input.decision.listAmount ?? null;
    if (listAmount !== null && (!Number.isInteger(listAmount) || listAmount <= 0)) {
      throw new FormatError("format_invalid_list_amount");
    }

    const { error: writeError } = await db
      .from("experience_offers")
      .update({
        amount,
        list_amount: listAmount,
        review_status: "approved",
        active: true,
        proposed_amount: null,
        reviewed_by: input.actorId,
        reviewed_at: now,
      })
      .eq("id", row.id);
    if (writeError) throw new FormatError(`format_write_failed:${writeError.message}`, 500);
    return;
  }

  if (input.decision.action === "decline") {
    if (row.review_status === "approved") {
      // Declining a price change on a live format keeps the format and its price.
      const { error: writeError } = await db
        .from("experience_offers")
        .update({ proposed_amount: null, reviewed_by: input.actorId, reviewed_at: now })
        .eq("id", row.id);
      if (writeError) throw new FormatError(`format_write_failed:${writeError.message}`, 500);
      return;
    }
    const { error: writeError } = await db
      .from("experience_offers")
      .update({ review_status: "declined", active: false, reviewed_by: input.actorId, reviewed_at: now })
      .eq("id", row.id);
    if (writeError) throw new FormatError(`format_write_failed:${writeError.message}`, 500);
    return;
  }

  if (row.review_status !== "approved") throw new FormatError("format_not_approved", 409);
  const active = input.decision.action === "resume";
  const { error: writeError } = await db.from("experience_offers").update({ active }).eq("id", row.id);
  if (writeError) throw new FormatError(`format_write_failed:${writeError.message}`, 500);
}
