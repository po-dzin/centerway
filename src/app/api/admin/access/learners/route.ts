import { NextRequest, NextResponse } from "next/server";
import {
    AccessError,
    isPaymentCurrency,
    listLearners,
    normalizeDeadline,
    provisionAccess,
    revokeCourse,
    setEnrollmentDeadline,
    type LearnerStatus,
    type PaymentCurrency,
} from "@/lib/admin/access";
import {
    badRequestResponse,
    parseLimitOffset,
    requireAdminSession,
    serverErrorResponse,
    unauthorizedResponse,
} from "@/lib/api/adminRoute";

const STATUSES: LearnerStatus[] = ["not_started", "in_progress", "stalled", "completed"];

function failed(error: unknown) {
    if (error instanceof AccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return serverErrorResponse(error instanceof Error ? error.message : "unknown_error");
}

// GET /api/admin/access/learners?q=&course=&status=&limit=&offset=
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const parsed = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
    // `parseLimitOffset` passes a non-numeric ?limit= straight through as NaN,
    // which slices to an empty page and reads as "no learners" rather than as
    // the bad request it is.
    const limit = Number.isFinite(parsed.limit) && parsed.limit > 0 ? parsed.limit : 50;
    const offset = Number.isFinite(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
    const status = searchParams.get("status") ?? "";

    try {
        const result = await listLearners({
            q: searchParams.get("q") ?? undefined,
            courseSlug: searchParams.get("course") ?? undefined,
            status: STATUSES.includes(status as LearnerStatus) ? (status as LearnerStatus) : "",
            limit,
            offset,
        });
        return NextResponse.json({ ...result, limit, offset });
    } catch (error) {
        return failed(error);
    }
}

type ProvisionBody = {
    email?: string;
    course?: string;
    fullName?: string;
    /** `YYYY-MM-DD` from the panel's date input, or an ISO instant. Empty clears. */
    expiresAt?: string | null;
    createAccount?: boolean;
    payment?: { amount?: unknown; currency?: unknown; note?: string } | null;
};

// POST /api/admin/access/learners { email, course, fullName?, expiresAt?, createAccount?, payment? }
export async function POST(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const body = (await req.json().catch(() => ({}))) as ProvisionBody;
    if (!body.email || !body.course) return badRequestResponse("email_and_course_required");

    const deadline = normalizeDeadline(body.expiresAt);
    if (!deadline.ok) return badRequestResponse("expires_at_invalid");

    // Payment is optional — a review grant or a gift carries no money — but a
    // half-typed one is rejected rather than silently dropped: an operator who
    // entered an amount and gets access without an order would only find the
    // missing sale in a revenue report weeks later.
    let payment: { amount: number; currency: PaymentCurrency; note?: string | null } | null = null;
    if (body.payment && body.payment.amount !== undefined && body.payment.amount !== null && body.payment.amount !== "") {
        const amount = Number(body.payment.amount);
        if (!Number.isFinite(amount) || amount <= 0) return badRequestResponse("amount_invalid");
        if (!isPaymentCurrency(body.payment.currency)) return badRequestResponse("currency_invalid");
        payment = { amount, currency: body.payment.currency, note: body.payment.note ?? null };
    }

    try {
        const result = await provisionAccess({
            email: body.email,
            fullName: body.fullName ?? null,
            courseSlug: body.course,
            expiresAt: deadline.value,
            createAccount: Boolean(body.createAccount),
            payment,
            actorId: session.user.id,
        });
        return NextResponse.json({
            created: result.grant.created,
            accountCreated: result.accountCreated,
            orderRef: result.payment?.orderRef ?? null,
            expiresAt: result.grant.expiresAt,
            enrollmentId: result.grant.enrollmentId,
            email: result.account.email,
            course: {
                slug: result.grant.course.slug,
                title: result.grant.course.title,
                status: result.grant.course.status,
            },
        });
    } catch (error) {
        return failed(error);
    }
}

// PATCH /api/admin/access/learners { enrollmentId, expiresAt } — set or clear a deadline
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const body = (await req.json().catch(() => ({}))) as { enrollmentId?: string; expiresAt?: string | null };
    if (!body.enrollmentId) return badRequestResponse("enrollment_id_required");

    const deadline = normalizeDeadline(body.expiresAt);
    if (!deadline.ok) return badRequestResponse("expires_at_invalid");

    try {
        const result = await setEnrollmentDeadline({
            enrollmentId: body.enrollmentId,
            expiresAt: deadline.value,
            actorId: session.user.id,
        });
        return NextResponse.json(result);
    } catch (error) {
        return failed(error);
    }
}

// DELETE /api/admin/access/learners?enrollmentId=...
export async function DELETE(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const enrollmentId = new URL(req.url).searchParams.get("enrollmentId");
    if (!enrollmentId) return badRequestResponse("enrollment_id_required");

    try {
        const result = await revokeCourse({ enrollmentId, actorId: session.user.id });
        return NextResponse.json(result);
    } catch (error) {
        return failed(error);
    }
}
