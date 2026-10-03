import { NextResponse } from "next/server";

import {
  AccessError,
  assertCourseGrantable,
  BULK_GRANT_LIMIT,
  isGrantSource,
  normalizeDeadline,
  parseEmailList,
  provisionAccess,
  type BulkGrantResult,
  type GrantSource,
} from "@/lib/admin/access";
import { badRequestResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { withRoute } from "@/lib/api/route";
import { errorMessage } from "@/lib/errors";
import { normalizeRef } from "@/lib/referral/ref";
import { parseCalendarDate } from "@/lms-core";

/* Two hundred sequential grants can outlast the default function budget; the
   cap in BULK_GRANT_LIMIT and the small worker pool below are sized to finish
   well inside this. */
export const maxDuration = 120;

/** Grants in flight at once. Enough to finish a full list in time, few enough not to crowd the auth admin API. */
const CONCURRENCY = 4;

type BulkBody = {
  emails?: unknown;
  course?: unknown;
  source?: unknown;
  cohortStartsOn?: unknown;
  ref?: unknown;
  expiresAt?: unknown;
  createAccount?: unknown;
  payment?: unknown;
  role?: unknown;
  fullName?: unknown;
};

/**
 * POST /api/admin/access/learners/bulk
 *   { emails, course, source?, cohortStartsOn?, ref?, expiresAt?, createAccount? }
 *
 * The single grant, repeated over a pasted list — for giving a flow's friends
 * and team their seats in one act instead of twenty dialogs with the same
 * cohort date typed into each.
 *
 * EVERYTHING IS CHECKED BEFORE ANYTHING IS WRITTEN: the addresses, the dates,
 * the tag and the course. A list with one typo is refused whole with that typo
 * named, rather than granted to nineteen people and left for the operator to
 * work out which line did not happen.
 *
 * AFTER THAT, ONE ADDRESS NEVER STOPS THE REST. A banned seat or an account
 * that does not exist is that line's answer in the result, and the others go
 * on. Each grant is `provisionAccess` itself, so each writes its own audit row
 * and nothing about a bulk seat differs from one granted in the dialog.
 *
 * NO MONEY AND NO ROLE. A list is gifts: a payment here would be one sum
 * recorded N times, and a role is an admin act per person that should never
 * ride along on a paste. Both are refused if sent rather than ignored, so a
 * client that thought it was recording a sale learns it was not.
 *
 * Same session rule as the single grant: `support` may hand out a course.
 */
export const POST = withRoute("admin.access.learners.bulk", async (req) => {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as BulkBody | null;
  if (!body || typeof body !== "object") return badRequestResponse("invalid_json");

  if (body.payment !== undefined && body.payment !== null) return badRequestResponse("bulk_payment_not_allowed");
  if (body.role !== undefined && body.role !== null) return badRequestResponse("bulk_role_not_allowed");

  const course = typeof body.course === "string" ? body.course.trim() : "";
  if (!course) return badRequestResponse("course_required");

  const { emails, invalid, duplicates } = parseEmailList(body.emails);
  if (invalid.length > 0) {
    return NextResponse.json({ error: "emails_invalid", invalid }, { status: 400 });
  }
  if (emails.length === 0) return badRequestResponse("emails_required");
  if (emails.length > BULK_GRANT_LIMIT) {
    return NextResponse.json(
      { error: "emails_too_many", limit: BULK_GRANT_LIMIT, count: emails.length },
      { status: 400 },
    );
  }

  // Unknown is refused here, where the single grant quietly falls back to
  // `manual`: on a list, the wrong reason would be written two hundred times.
  // Absent means `bonus` — a list carries no money, so it is a gift by default.
  let source: GrantSource = "bonus";
  if (body.source !== undefined && body.source !== null && body.source !== "") {
    if (!isGrantSource(body.source)) return badRequestResponse("source_invalid");
    source = body.source;
  }

  const deadline = normalizeDeadline(body.expiresAt);
  if (!deadline.ok) return badRequestResponse("expires_at_invalid");

  let cohortStartsOn: string | null | undefined;
  if (body.cohortStartsOn !== undefined) {
    if (body.cohortStartsOn !== null && typeof body.cohortStartsOn !== "string") {
      return badRequestResponse("cohort_date_invalid");
    }
    const typed = (body.cohortStartsOn ?? "").trim();
    if (typed && !parseCalendarDate(typed)) return badRequestResponse("cohort_date_invalid");
    cohortStartsOn = typed || null;
  }

  const ref = normalizeRef(body.ref);
  if (body.ref && !ref) return badRequestResponse("ref_invalid");

  // The course is the one thing every line shares, so it is asked about once.
  // An AccessError here (not found, not published) leaves through `withRoute`
  // with its own status, before a single account or seat exists.
  await assertCourseGrantable(course);

  const createAccount = body.createAccount === true;
  const actorId = session.user.id;

  const grantOne = async (email: string): Promise<BulkGrantResult> => {
    try {
      const result = await provisionAccess({
        email,
        courseSlug: course,
        // As in the single grant: ABSENT leaves the term to the offer (which,
        // with no payment, is no deadline at all); an explicit null is forever.
        expiresAt: body.expiresAt === undefined ? undefined : deadline.value,
        source,
        createAccount,
        payment: null,
        cohortStartsOn,
        ref: ref ?? undefined,
        actorId,
      });
      return {
        email,
        outcome: result.grant.created ? "created" : "already",
        accountCreated: result.accountCreated,
        enrollmentId: result.grant.enrollmentId,
        error: null,
      };
    } catch (error) {
      // The code, not the prose: the panel translates the known ones, and a
      // database message naming tables belongs in the log, not on screen.
      const code = error instanceof AccessError && error.status < 500 ? error.message : "grant_failed";
      if (code === "grant_failed") console.error("access.bulk: grant failed", { email, error: errorMessage(error) });
      return { email, outcome: "error", accountCreated: false, enrollmentId: null, error: code };
    }
  };

  // A small pool rather than `Promise.all`: two hundred at once would be two
  // hundred `createUser` calls racing the auth API's rate limit. The addresses
  // are distinct after `parseEmailList`, so no two workers touch one person.
  const results: BulkGrantResult[] = new Array(emails.length);
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < emails.length; index = next++) {
      const email = emails[index];
      if (email !== undefined) results[index] = await grantOne(email);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, emails.length) }, worker));

  const count = (outcome: BulkGrantResult["outcome"]) => results.filter((row) => row.outcome === outcome).length;
  return NextResponse.json({
    course,
    source,
    cohortStartsOn: cohortStartsOn ?? null,
    duplicates,
    summary: {
      total: results.length,
      created: count("created"),
      already: count("already"),
      failed: count("error"),
      accountsCreated: results.filter((row) => row.accountCreated).length,
    },
    results,
  });
});
