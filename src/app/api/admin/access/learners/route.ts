import { NextRequest, NextResponse } from "next/server";
import {
    AccessError,
    blockCourse,
    isGrantableRole,
    isGrantSource,
    isPaymentCurrency,
    listPeople,
    normalizeDeadline,
    provisionAccess,
    reactivateCourse,
    revokeCourse,
    setEnrollmentDeadline,
    setRole,
    unblockCourse,
    type LearnerStatus,
    type PaymentCurrency,
} from "@/lib/admin/access";
import {
    badRequestResponse,
    forbiddenResponse,
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

/**
 * GET — the one list of people.
 *
 * `?q=` `?role=` `?access=` `?course=` `?status=` `?limit=` `?offset=`
 *
 * It used to be two: this one, which started from enrollments and so could not
 * see an account holding no course, and `/access/accounts`, which started from
 * accounts and so could not show what they held. That route is gone; every
 * facet it had is a parameter here. See docs/admin-access-shape-2026-08-28.md.
 *
 * An unknown value for a facet is DROPPED rather than passed on: filtering on
 * nonsense should read as "no filter", not as "nobody".
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const parsed = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
    // `parseLimitOffset` passes a non-numeric ?limit= straight through as NaN,
    // which slices to an empty page and reads as "nobody" rather than as the
    // bad request it is.
    const limit = Number.isFinite(parsed.limit) && parsed.limit > 0 ? parsed.limit : 50;
    const offset = Number.isFinite(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;

    const status = searchParams.get("status") ?? "";
    const role = searchParams.get("role") ?? "";
    const access = searchParams.get("access") ?? "";

    try {
        const result = await listPeople({
            q: searchParams.get("q") ?? undefined,
            role: role === "staff" || isGrantableRole(role) ? role : undefined,
            access: access === "enrolled" || access === "none" ? access : "",
            courseSlug: searchParams.get("course") ?? undefined,
            status: STATUSES.includes(status as LearnerStatus) ? (status as LearnerStatus) : "",
            limit,
            offset,
        });
        // `canGrant` came from the accounts route and comes from here now:
        // `support` may read this list and hand out a course, but the role
        // control stays with admin. `selfId` lets the panel disable the row
        // that would 409 with `cannot_change_own_role`.
        return NextResponse.json({
            ...result,
            limit,
            offset,
            canGrant: session.role === "admin",
            selfId: session.user.id,
        });
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
    /** `manual` (default), `bonus` or `promotion` — why this seat exists. */
    source?: string;
    /**
     * An elevated role to give the account, admin-only and optional.
     *
     * Absent means "leave the role alone", which is not the same as `user`:
     * sending `user` to an existing coach would quietly demote them, and the
     * panel omits the field rather than defaulting it for exactly that reason.
     */
    role?: string;
};

// POST /api/admin/access/learners { email, course, fullName?, expiresAt?, createAccount?, payment?, role? }
// The return type is stated rather than inferred: this handler has six exit
// points, and the union of their response shapes was wide enough that callers
// (the route tests' `Promise.all` over every endpoint) fell back to `any`.
export async function POST(req: NextRequest): Promise<NextResponse> {
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

    // Checked BEFORE anything is written: a role the caller may not hand out
    // should fail the whole request, not leave a seat granted and a 403 on the
    // half that mattered. `support` may sell a course; only admin sets roles,
    // which is the same line the roles route draws.
    if (body.role !== undefined) {
        if (!isGrantableRole(body.role)) return badRequestResponse("email_and_valid_role_required");
        if (session.role !== "admin") return forbiddenResponse();
    }

    try {
        const result = await provisionAccess({
            email: body.email,
            fullName: body.fullName ?? null,
            courseSlug: body.course,
            expiresAt: deadline.value,
            source: isGrantSource(body.source) ? body.source : undefined,
            createAccount: Boolean(body.createAccount),
            payment,
            actorId: session.user.id,
        });
        // AFTER provisioning, never before: the account may not have existed
        // until `provisionAccess` created it, and `setRole` resolves by email
        // and 404s on an account that is not there yet.
        let role: string | null = null;
        if (body.role !== undefined && isGrantableRole(body.role)) {
            const assigned = await setRole({ email: body.email, role: body.role, actorId: session.user.id });
            role = assigned.role;
        }

        return NextResponse.json({
            created: result.grant.created,
            accountCreated: result.accountCreated,
            role,
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

/**
 * PATCH /api/admin/access/learners { enrollmentId, action?, expiresAt?, reason? }
 *
 * One endpoint for every change to an existing seat, because they are one
 * decision to the operator: move the date, close it, open it again, ban.
 * `action` defaults to `deadline`, which is what this route did before the
 * others existed — an old client keeps working.
 */
const ACTIONS = ["deadline", "revoke", "reactivate", "block", "unblock"] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const body = (await req.json().catch(() => ({}))) as {
        enrollmentId?: string;
        action?: string;
        expiresAt?: string | null;
        reason?: string | null;
    };
    if (!body.enrollmentId) return badRequestResponse("enrollment_id_required");

    const action = (body.action ?? "deadline") as Action;
    if (!ACTIONS.includes(action)) return badRequestResponse("action_invalid");

    const actorId = session.user.id;
    const enrollmentId = body.enrollmentId;

    try {
        if (action === "revoke") {
            return NextResponse.json(await revokeCourse({ enrollmentId, actorId, reason: body.reason ?? null }));
        }
        if (action === "block") {
            return NextResponse.json(await blockCourse({ enrollmentId, actorId, reason: body.reason ?? null }));
        }
        if (action === "unblock") {
            return NextResponse.json(await unblockCourse({ enrollmentId, actorId }));
        }

        const deadline = normalizeDeadline(body.expiresAt);
        if (!deadline.ok) return badRequestResponse("expires_at_invalid");

        if (action === "reactivate") {
            // `expiresAt` absent means "leave the date alone"; an empty string
            // clears it. `normalizeDeadline` collapses both to null, so the raw
            // body decides which of the two the operator meant.
            const expiresAt = body.expiresAt === undefined ? undefined : deadline.value;
            return NextResponse.json(await reactivateCourse({ enrollmentId, actorId, expiresAt }));
        }

        return NextResponse.json(
            await setEnrollmentDeadline({ enrollmentId, expiresAt: deadline.value, actorId })
        );
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
