/**
 * The owner's side of the format constructor (2026-09-25).
 *
 * GET   /api/admin/offer-formats — every format of every program, proposals first.
 * PATCH /api/admin/offer-formats { code, action, amount?, listAmount? }
 *       approve (sets the LIVE price, which may differ from the proposal),
 *       decline, withdraw, resume.
 *
 * Read by any admin session, like the catalogue; decided only by an admin,
 * because a price is the owner's (creator contract, 2026-08-22).
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { FormatError, listFormatsForReview, reviewFormat, type ReviewAction } from "@/lib/experiences/formatAuthoring";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
import { PRODUCT_OFFERS_TAG } from "@/lib/platform/productOffers";
import {
  badRequestResponse,
  forbiddenResponse,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";

function failed(error: unknown) {
  if (error instanceof FormatError) return NextResponse.json({ error: error.code }, { status: error.status });
  return serverErrorResponse(error instanceof Error ? error.message : "unknown_error");
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json({ formats: await listFormatsForReview(), canEdit: session.role === "admin" });
  } catch (error) {
    return failed(error);
  }
}

function optionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();

  const body = (await req.json().catch(() => ({}))) as {
    code?: unknown;
    courseSlug?: unknown;
    action?: unknown;
    amount?: unknown;
    listAmount?: unknown;
  };
  if (typeof body.code !== "string" || !body.code) return badRequestResponse("format_code_required");

  let decision: ReviewAction;
  if (body.action === "approve") {
    const amount = optionalInteger(body.amount);
    const listAmount = optionalInteger(body.listAmount);
    if (Number.isNaN(amount)) return badRequestResponse("format_invalid_amount");
    if (Number.isNaN(listAmount)) return badRequestResponse("format_invalid_list_amount");
    decision = { action: "approve", amount, listAmount };
  } else if (body.action === "decline" || body.action === "withdraw" || body.action === "resume") {
    decision = { action: body.action };
  } else {
    return badRequestResponse("format_invalid_action");
  }

  try {
    await reviewFormat({ code: body.code, actorId: session.user.id, decision });
    // The page reads formats through a tagged cache: an approval that is not
    // purged would not be on sale for five minutes, a withdrawal would keep selling.
    if (typeof body.courseSlug === "string" && body.courseSlug) revalidateTag(courseTag(body.courseSlug), PURGE);
    revalidateTag(COURSE_LIST_TAG, PURGE);
    revalidateTag(PRODUCT_OFFERS_TAG, PURGE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
