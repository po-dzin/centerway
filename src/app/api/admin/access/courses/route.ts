import { NextRequest, NextResponse } from "next/server";
import { AccessError, listCourses, setCourseAuthor } from "@/lib/admin/access";
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

// GET /api/admin/access/courses — the course list, its authors, its learner counts.
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        const items = await listCourses();
        return NextResponse.json({ items, canGrant: session.role === "admin" });
    } catch (error) {
        return failed(error);
    }
}

// PATCH /api/admin/access/courses { courseId, email | null }
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    if (session.role !== "admin") return forbiddenResponse();

    const body = (await req.json().catch(() => ({}))) as { courseId?: string; email?: string | null };
    if (!body.courseId) return badRequestResponse("course_id_required");

    try {
        const result = await setCourseAuthor({
            courseId: body.courseId,
            email: body.email?.trim() ? body.email.trim() : null,
            actorId: session.user.id,
        });
        return NextResponse.json({
            course: { id: result.course.id, slug: result.course.slug },
            author: result.account ? { email: result.account.email } : null,
        });
    } catch (error) {
        return failed(error);
    }
}
