import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { importLessonDocument } from "@/lib/lms/lessonDocuments";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 20;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug).catch(() => null);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const files = form?.getAll("files").filter((entry): entry is File => entry instanceof File) ?? [];
  if (!files.length) return NextResponse.json({ error: "lms_lesson_document_missing_file" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: "lms_lesson_document_too_many_files" }, { status: 413 });
  if (files.some((file) => file.size > MAX_FILE_BYTES)) {
    return NextResponse.json({ error: "lms_lesson_document_too_large" }, { status: 413 });
  }

  try {
    const taken = loaded.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.slug));
    const lessons = [];
    for (const file of files) {
      const lesson = await importLessonDocument(
        { filename: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
        { ids: randomUUID, takenSlugs: taken, order: lessons.length + 1 },
      );
      lessons.push(lesson);
      taken.push(lesson.slug);
    }
    return NextResponse.json({ lessons });
  } catch (error) {
    const message = error instanceof Error ? error.message : "lms_lesson_document_import_failed";
    const status = message === "lms_lesson_document_unsupported_format" ? 415 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
