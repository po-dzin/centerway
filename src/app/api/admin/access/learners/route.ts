import { NextRequest, NextResponse } from "next/server";
import {
    AccessError,
    grantCourse,
    listLearners,
    revokeCourse,
    type LearnerStatus,
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

// POST /api/admin/access/learners { email, course }
export async function POST(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const body = (await req.json().catch(() => ({}))) as { email?: string; course?: string };
    if (!body.email || !body.course) return badRequestResponse("email_and_course_required");

    try {
        const result = await grantCourse({
            email: body.email,
            courseSlug: body.course,
            actorId: session.user.id,
        });
        return NextResponse.json({
            created: result.created,
            enrollmentId: result.enrollmentId,
            email: result.account.email,
            course: { slug: result.course.slug, title: result.course.title, status: result.course.status },
        });
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
