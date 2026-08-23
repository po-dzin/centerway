import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import {
  exportLessonDocument,
  LESSON_DOCUMENT_FORMATS,
  validatePortableLesson,
  type LessonDocumentFormat,
} from "@/lib/lms/lessonDocuments";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug).catch(() => null);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { lesson?: unknown; format?: unknown } | null;
  const format = body?.format as LessonDocumentFormat | undefined;
  if (!format || !(LESSON_DOCUMENT_FORMATS as readonly string[]).includes(format)) {
    return NextResponse.json({ error: "lms_lesson_document_unsupported_format" }, { status: 415 });
  }

  try {
    validatePortableLesson(body?.lesson);
    const file = await exportLessonDocument(body.lesson, format);
    return new NextResponse(Buffer.from(file.body), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${file.filename}"`,
        "content-type": file.mime,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "lms_lesson_document_export_failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
