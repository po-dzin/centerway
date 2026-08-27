/**
 * The reader's own marks: /api/lms/annotations
 *
 *   GET    ?courseSlug=…                 every mark this reader made in the course
 *   POST   { courseSlug, annotation }    create or replace one mark
 *   DELETE ?courseSlug=…&clientId=…      remove one mark
 *
 * Addressed by the CLIENT-generated id, never by a database id: the reader's
 * device names a mark the moment it is drawn, so the highlight can be painted
 * and then edited without waiting for a round trip to learn what it is called.
 *
 * PRIVACY. The enrollment is resolved from the bearer token on every call and
 * every query is filtered by it, so there is no shape of request that reaches
 * another reader's notes — including the course author's own request for their
 * course. See the migration header for why that is deliberate.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadLearnerCourse } from "@/lib/lms/server";
import { deleteAnnotation, listAnnotations, saveAnnotation } from "@/lib/lms/annotations";
import { findLesson, flattenLessons, type AnnotationKind } from "@/lms-core";

export const runtime = "nodejs";

const FAILURE_STATUS: Record<string, number> = {
  course_not_found: 404,
  not_published: 404,
  not_entitled: 403,
  expired: 403,
  revoked: 403,
  blocked: 403,
};

async function context(req: NextRequest, courseSlug: string) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  if (!courseSlug) return { error: NextResponse.json({ error: "missing_course_slug" }, { status: 400 }) } as const;

  const result = await loadLearnerCourse(
    { authUserId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) },
    courseSlug
  );
  if (!result.ok) {
    return {
      error: NextResponse.json({ error: result.reason }, { status: FAILURE_STATUS[result.reason] ?? 400 }),
    } as const;
  }
  return { ok: result.context } as const;
}

function lessonSlugById(course: Parameters<typeof flattenLessons>[0]): Map<string, string> {
  return new Map(flattenLessons(course).map((entry) => [entry.lesson.id, entry.lesson.slug]));
}

export async function GET(req: NextRequest) {
  const resolved = await context(req, req.nextUrl.searchParams.get("courseSlug") ?? "");
  if (resolved.error) return resolved.error;

  const { course, enrollment } = resolved.ok;
  const annotations = await listAnnotations(enrollment.id, lessonSlugById(course));
  return NextResponse.json({ annotations, courseVersion: course.version });
}

export async function POST(req: NextRequest) {
  let body: {
    courseSlug?: unknown;
    annotation?: {
      clientId?: unknown;
      kind?: unknown;
      lessonSlug?: unknown;
      note?: unknown;
      anchor?: { blockId?: unknown; start?: unknown; end?: unknown; quote?: unknown; prefix?: unknown } | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const resolved = await context(req, typeof body.courseSlug === "string" ? body.courseSlug : "");
  if (resolved.error) return resolved.error;
  const { course, enrollment } = resolved.ok;

  const incoming = body.annotation ?? {};
  const clientId = typeof incoming.clientId === "string" ? incoming.clientId.trim() : "";
  const kind = incoming.kind as AnnotationKind;
  const lessonSlug = typeof incoming.lessonSlug === "string" ? incoming.lessonSlug : "";

  if (!clientId || clientId.length > 128) return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });
  if (kind !== "bookmark" && kind !== "highlight") return NextResponse.json({ error: "unknown_kind" }, { status: 400 });

  const found = findLesson(course, lessonSlug);
  if (!found) return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });

  // A highlight without a usable anchor is not a highlight. The database says
  // the same thing in a CHECK constraint; this is the readable half of it.
  let anchor: { blockId: string; start: number; end: number; quote: string; prefix: string } | null = null;
  if (kind === "highlight") {
    const raw = incoming.anchor ?? null;
    const blockId = typeof raw?.blockId === "string" ? raw.blockId : "";
    const start = typeof raw?.start === "number" ? Math.trunc(raw.start) : -1;
    const end = typeof raw?.end === "number" ? Math.trunc(raw.end) : -1;
    const quote = typeof raw?.quote === "string" ? raw.quote : "";
    const prefix = typeof raw?.prefix === "string" ? raw.prefix : "";
    if (!blockId || start < 0 || end <= start || !quote.trim()) {
      return NextResponse.json({ error: "invalid_anchor" }, { status: 400 });
    }
    anchor = { blockId, start, end, quote, prefix };
  }

  const note = typeof incoming.note === "string" ? incoming.note : null;
  if (kind === "bookmark" && note) return NextResponse.json({ error: "bookmark_takes_no_note" }, { status: 400 });

  const annotation = await saveAnnotation({
    enrollmentId: enrollment.id,
    lessonId: found.lesson.id,
    lessonSlug: found.lesson.slug,
    clientId,
    kind,
    courseVersion: course.version,
    anchor,
    note,
  });

  return NextResponse.json({ annotation });
}

export async function DELETE(req: NextRequest) {
  const resolved = await context(req, req.nextUrl.searchParams.get("courseSlug") ?? "");
  if (resolved.error) return resolved.error;

  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  if (!clientId) return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });

  await deleteAnnotation(resolved.ok.enrollment.id, clientId);
  return NextResponse.json({ ok: true });
}
