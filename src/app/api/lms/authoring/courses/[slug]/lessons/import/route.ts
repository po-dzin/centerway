import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { withCourseAccess } from "@/lib/lms/courseAccess";
import { importLessonDocument } from "@/lib/lms/lessonDocuments";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 20;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return withCourseAccess(req, slug, async (grant) => {
    const form = await req.formData().catch(() => null);
    const files = form?.getAll("files").filter((entry): entry is File => entry instanceof File) ?? [];
    if (!files.length) return NextResponse.json({ error: "lms_lesson_document_missing_file" }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: "lms_lesson_document_too_many_files" }, { status: 413 });
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json({ error: "lms_lesson_document_too_large" }, { status: 413 });
    }

    try {
      const loaded = await grant.load();
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
  }, LMS_COURSE_WRITE);
}
