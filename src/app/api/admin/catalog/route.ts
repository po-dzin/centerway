/**
 * The owner's catalogue: what is on sale, at what price, for how long.
 *
 * READ is open to any admin session (support included) — knowing what a course
 * costs is part of answering a buyer. WRITE is admin-only, because the price
 * and the term are the owner's and `lms_course_offers` carries a single admin
 * policy to say so (2026-08-22 storefront migration).
 *
 * Publication itself is NOT here: approving a course and setting its visibility
 * belong to /api/admin/access/courses, which owns what the course claims about
 * itself. One screen reads both; that does not make them one subject.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { AccessError } from "@/lib/admin/access";
import { listCatalog, saveOffer, setOfferActive } from "@/lib/admin/catalog";
import { COURSE_LIST_TAG, PURGE, courseTag } from "@/lib/lms/liveCatalog";
import {
    badRequestResponse,
    forbiddenResponse,
    requireAdminSession,
    serverErrorResponse,
    unauthorizedResponse,
} from "@/lib/api/adminRoute";

function failed(error: unknown) {
    if (error instanceof AccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return serverErrorResponse(error instanceof Error ? error.message : "unknown_error");
}

// GET /api/admin/catalog — every course with its offer and what blocks its sale.
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        return NextResponse.json({ items: await listCatalog(), canEdit: session.role === "admin" });
    } catch (error) {
        return failed(error);
    }
}

type Body = {
    courseId?: string;
    action?: "save_offer" | "withdraw_offer" | "resume_offer";
    amount?: unknown;
    listAmount?: unknown;
    currency?: string;
    accessDays?: unknown;
    accessLifetime?: boolean;
};

function optionalInteger(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
}

// PATCH /api/admin/catalog { courseId, action, ... }
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    if (session.role !== "admin") return forbiddenResponse();

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.courseId) return badRequestResponse("course_id_required");

    const actorId = session.user.id;

    try {
        if (body.action === "withdraw_offer" || body.action === "resume_offer") {
            const result = await setOfferActive({
                courseId: body.courseId,
                active: body.action === "resume_offer",
                actorId,
            });
            // The price is read through a tagged cache on the offer page, so a
            // withdrawal that is not purged keeps selling for five minutes.
            revalidateTag(courseTag(result.courseSlug), PURGE);
            revalidateTag(COURSE_LIST_TAG, PURGE);
            return NextResponse.json(result);
        }

        const amount = optionalInteger(body.amount);
        if (amount === null || Number.isNaN(amount)) return badRequestResponse("amount_invalid");

        const listAmount = optionalInteger(body.listAmount);
        if (Number.isNaN(listAmount)) return badRequestResponse("list_amount_invalid");

        const accessDays = optionalInteger(body.accessDays);
        if (Number.isNaN(accessDays)) return badRequestResponse("access_rule_required");

        const result = await saveOffer({
            courseId: body.courseId,
            actorId,
            amount,
            listAmount,
            currency: body.currency,
            accessDays,
            accessLifetime: Boolean(body.accessLifetime),
        });
        revalidateTag(courseTag(result.courseSlug), PURGE);
        revalidateTag(COURSE_LIST_TAG, PURGE);
        return NextResponse.json(result);
    } catch (error) {
        return failed(error);
    }
}
