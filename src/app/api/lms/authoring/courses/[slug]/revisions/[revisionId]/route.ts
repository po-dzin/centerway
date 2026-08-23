import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { loadCourseRevision } from "@/lib/lms/revisions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; revisionId: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug, revisionId } = await params;
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug).catch(() => null);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }
  try {
    const revision = await loadCourseRevision(loaded.course.id, revisionId);
    if (!revision) return NextResponse.json({ error: "revision_not_found" }, { status: 404 });
    return NextResponse.json({ revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
  }
}
