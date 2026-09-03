/**
 * Prices for the products that have no course of their own.
 *
 * Sibling of /api/admin/catalog, and split from it for the same reason that one
 * is split from /api/admin/access/courses: a different subject with a different
 * table. That route prices a COURSE, keyed on `course_id` in
 * `lms_course_offers`. This one prices a product CODE in `product_offers` —
 * a package sold as an enquiry, a blend that is not a course at all.
 *
 * READ is open to any admin session: knowing what something costs is part of
 * answering a buyer. WRITE is admin-only, because the price is the owner's.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { AccessError } from "@/lib/admin/access";
import { listProductOffers, saveProductOffer, setProductOfferActive } from "@/lib/admin/productOffers";
import { PURGE } from "@/lib/lms/liveCatalog";
import { PRODUCT_OFFERS_TAG } from "@/lib/platform/productOffers";
import type { ProductOfferKind } from "@/lib/platform/productOffers";
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

// GET /api/admin/catalog/products
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        return NextResponse.json({ items: await listProductOffers(), canEdit: session.role === "admin" });
    } catch (error) {
        return failed(error);
    }
}

type Body = {
    code?: string;
    action?: "save" | "withdraw" | "resume";
    amount?: unknown;
    listAmount?: unknown;
    currency?: string;
    kind?: string;
};

/**
 * `null` for "no agreed price" and NaN for "you typed something that is not a
 * number" are different answers, and the service must be able to tell them
 * apart — an empty field is «за запитом», a stray letter is a mistake.
 */
function optionalInteger(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
}

// PATCH /api/admin/catalog/products { code, action, ... }
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    if (session.role !== "admin") return forbiddenResponse();

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.code) return badRequestResponse("code_required");

    try {
        if (body.action === "withdraw" || body.action === "resume") {
            const offer = await setProductOfferActive(body.code, body.action === "resume");
            revalidateTag(PRODUCT_OFFERS_TAG, PURGE);
            return NextResponse.json({ ok: true, offer });
        }

        const amount = optionalInteger(body.amount);
        const listAmount = optionalInteger(body.listAmount);
        if (Number.isNaN(amount)) return badRequestResponse("product_amount_invalid");
        if (Number.isNaN(listAmount)) return badRequestResponse("product_list_amount_invalid");

        // Coercing an unrecognised value to "lead" would silently refuse a
        // checkout for a product meant to sell one, with no error shown. The
        // service already validates this; the route must not paper over it.
        if (body.kind !== "checkout" && body.kind !== "lead") return badRequestResponse("product_kind_invalid");
        const kind: ProductOfferKind = body.kind;

        const offer = await saveProductOffer({
            code: body.code,
            amount,
            listAmount,
            currency: body.currency,
            kind,
        });

        /* The price is read through `unstable_cache` on both the checkout and
           the landing pages, so an edit that is not published is an edit the
           owner cannot see. */
        revalidateTag(PRODUCT_OFFERS_TAG, PURGE);
        return NextResponse.json({ ok: true, offer });
    } catch (error) {
        return failed(error);
    }
}
