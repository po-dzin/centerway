import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse, submitBuilderCourseForReview } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug).catch(() => null);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }
  try {
    await submitBuilderCourseForReview(slug);
    return NextResponse.json({ status: "in_review" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message.startsWith("lms_") ? 422 : 500 });
  }
}
