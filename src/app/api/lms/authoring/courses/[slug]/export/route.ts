/** Export the current database course as the canonical portable Course JSON. */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);

  try {
    const loaded = await loadBuilderCourse(slug);
    if (!loaded || !canEditCourse(identity, loaded.authorId)) {
      return NextResponse.json({ error: "course_not_found" }, { status: 404 });
    }

    return new NextResponse(`${JSON.stringify(loaded.course, null, 2)}\n`, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${loaded.course.slug}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
