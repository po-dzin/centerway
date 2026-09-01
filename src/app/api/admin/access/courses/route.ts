import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { AccessError, deleteAdminCourse, listAuthorProfiles, listCourses, moderateCourse, setCourseAuthor, setCourseAuthorProfile } from "@/lib/admin/access";
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

export async function DELETE(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    if (session.role !== "admin") return forbiddenResponse();
    const body = await req.json().catch(() => null);
    if (typeof body?.courseId !== "string" || typeof body?.confirmSlug !== "string") {
        return badRequestResponse("course_delete_confirmation_required");
    }
    try {
        const result = await deleteAdminCourse({ courseId: body.courseId, confirmSlug: body.confirmSlug, actorId: session.user.id });
        revalidateTag(courseTag(result.slug), PURGE);
        revalidateTag(COURSE_LIST_TAG, PURGE);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return failed(error);
    }
}

// GET /api/admin/access/courses — the course list, its authors, its learner counts.
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        const [items, authorProfiles] = await Promise.all([listCourses(), listAuthorProfiles()]);
        return NextResponse.json({ items, authorProfiles, canGrant: session.role === "admin" });
    } catch (error) {
        return failed(error);
    }
}

// PATCH /api/admin/access/courses { courseId, email | null }
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    if (session.role !== "admin") return forbiddenResponse();

    const body = (await req.json().catch(() => ({}))) as { courseId?: string; email?: string | null; action?: "approve" | "request_changes" | "set_visibility" | "set_author_profile"; authorProfileId?: string | null; note?: string; visibility?: "hidden" | "unlisted" | "listed" };
    if (!body.courseId) return badRequestResponse("course_id_required");

    try {
        if (body.action === "set_author_profile") {
            const result = await setCourseAuthorProfile({
                courseId: body.courseId,
                authorProfileId: body.authorProfileId?.trim() || null,
                actorId: session.user.id,
            });
            revalidateTag(courseTag(result.slug), PURGE);
            revalidateTag(COURSE_LIST_TAG, PURGE);
            return NextResponse.json({ course: result });
        }
        if (body.action) {
            const result = await moderateCourse({ courseId: body.courseId, actorId: session.user.id, action: body.action, note: body.note, visibility: body.visibility });
            revalidateTag(courseTag(result.slug), PURGE);
            revalidateTag(COURSE_LIST_TAG, PURGE);
            return NextResponse.json({ course: result });
        }
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
