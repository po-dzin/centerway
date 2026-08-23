/**
 * POST /api/lms/authoring/media — an image the author has, rather than one they
 * have to deploy.
 *
 * WHY A ROUTE AND NOT A DIRECT UPLOAD. The browser could talk to Supabase
 * Storage itself, and the bucket would then need a policy encoding "may this
 * person write into this course's folder" — the same ownership rule
 * `canEditCourse` already holds, written a second time in SQL, against a
 * different notion of who an author is. Two rules that can disagree about
 * authorship is exactly the class of bug the role-store merge cleaned up. So
 * the bucket has no write policy at all: nothing reaches it except this route,
 * holding the service role, after the check the rest of the authoring API makes.
 *
 * WHAT IT DOES NOT DO. No resizing, no format conversion, no stripping of EXIF.
 * Each of those is a real image pipeline and a dependency, and none of them is
 * what "I have a photo" needs today. The size ceiling is the crude version of
 * all three, and it is stated to the author rather than applied silently.
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "course-media";

/** 5 MB, the same ceiling the bucket itself carries. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The types that are pictures and nothing else.
 *
 * SVG is deliberately absent — see the bucket migration. It is a document that
 * can carry script, and while an `<img>` never runs it, a direct visit to the
 * object URL does.
 */
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "media_expected_form_data" }, { status: 400 });
  }

  const slug = form.get("courseSlug");
  const file = form.get("file");

  if (typeof slug !== "string" || slug === "") {
    return NextResponse.json({ error: "media_missing_course" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "media_missing_file" }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: `media_unsupported_type:${file.type || "unknown"}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `media_too_large:${file.size}` }, { status: 413 });
  }

  // The course is resolved BEFORE the bytes go anywhere: an upload that turns
  // out to belong to a course the caller cannot edit would otherwise already be
  // sitting in the bucket by the time anyone said no.
  const identity = await resolveBuilderIdentity(user);
  const loaded = await loadBuilderCourse(slug);
  if (!loaded || !canEditCourse(identity, loaded.authorId)) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  // Foldered by course so a deleted course's images can be found and swept, and
  // named by uuid rather than by the original filename: two authors uploading
  // `cover.jpg` must not be one upload, and a filename is attacker-shaped input
  // that would otherwise become a path.
  const path = `courses/${loaded.course.id}/${randomUUID()}.${extension}`;

  const storage = supabaseAdmin().storage.from(BUCKET);
  const { error } = await storage.upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    // Every path is unique, so an upsert could only ever mean a collision on a
    // uuid — which is a bug worth hearing about rather than overwriting.
    upsert: false,
    // A year: the path is content-addressed by uuid, so the bytes at it never
    // change. Replacing an image writes a new path.
    cacheControl: "31536000",
  });

  if (error) {
    return NextResponse.json({ error: `media_upload_failed:${error.message}` }, { status: 502 });
  }

  const { data } = storage.getPublicUrl(path);
  return NextResponse.json({ src: data.publicUrl, path });
}
