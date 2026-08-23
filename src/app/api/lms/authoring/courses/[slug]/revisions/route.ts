import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { createCourseRevision, listCourseRevisions } from "@/lib/lms/revisions";

async function authorized(req: NextRequest, slug: string) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return { failure: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug).catch(() => null);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return { failure: NextResponse.json({ error: "course_not_found" }, { status: 404 }) } as const;
  }
  return { identity, loaded } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await authorized(req, slug);
  if ("failure" in access) return access.failure;
  try {
    return NextResponse.json({ revisions: await listCourseRevisions(access.loaded.course.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await authorized(req, slug);
  if ("failure" in access) return access.failure;
  const body = (await req.json().catch(() => ({}))) as { label?: unknown };
  if (body.label !== undefined && (typeof body.label !== "string" || body.label.trim().length > 120)) {
    return NextResponse.json({ error: "lms_revision_invalid_label" }, { status: 422 });
  }
  try {
    const revision = await createCourseRevision({
      course: access.loaded.course,
      kind: "manual",
      actorId: access.identity.authUserId,
      label: typeof body.label === "string" ? body.label : null,
    });
    return NextResponse.json({ revision }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
  }
}
