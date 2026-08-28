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
 * WHAT CHANGED ON 2026-08-28. It used to store the bytes it was handed, and the
 * 5 MB ceiling was the crude stand-in for a resize, a re-encode and an EXIF
 * strip. It is a pipeline now — see `mediaPipeline.ts` for why that moved here
 * rather than into the browser. The ceiling moved with it: 20 MB of camera
 * photograph goes IN, a couple of hundred kilobytes of WebP comes out, and the
 * author no longer has to know the difference.
 *
 * AND IT NOW WRITES A ROW. `lms_media_assets` records what went in — see the
 * ledger migration for why that record is not the same thing as an inventory,
 * and why the sweeper deliberately does not read it.
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { canEditCourse, resolveBuilderIdentity } from "@/lib/lms/builderAccess";
import { loadBuilderCourse } from "@/lib/lms/builder";
import { MAX_INPUT_BYTES, isPrepareFailure, prepareMedia } from "@/lib/lms/mediaPipeline";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Decoding and re-encoding a 20 MP photograph is seconds, not milliseconds. */
export const maxDuration = 60;

const BUCKET = "course-media";

/**
 * The types that are pictures and nothing else.
 *
 * SVG is deliberately absent — see the bucket migration. It is a document that
 * can carry script, and while an `<img>` never runs it, a direct visit to the
 * object URL does.
 *
 * The values are gone: the stored extension is decided by the pipeline now, not
 * by what the author's file happened to be.
 */
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

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

  if (!TYPES.has(file.type)) {
    return NextResponse.json({ error: `media_unsupported_type:${file.type || "unknown"}` }, { status: 415 });
  }
  // Checked before the body is read into memory as well as inside the pipeline:
  // there is no reason to hold twenty-five megabytes in a function's heap only
  // to refuse them.
  if (file.size > MAX_INPUT_BYTES) {
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

  const prepared = await prepareMedia(Buffer.from(await file.arrayBuffer()), file.type);
  if (isPrepareFailure(prepared)) {
    const status = prepared.error === "media_not_an_image" ? 415 : 413;
    return NextResponse.json({ error: prepared.error }, { status });
  }

  // A FOLDER PER IMAGE, not a file per image. Foldered by course so a deleted
  // course's images can be found and swept; foldered again by uuid because one
  // upload is now several objects, and their relationship has to survive being
  // read back from nothing but a URL — which is exactly what `mediaSources`
  // does on the rendering side. Named by uuid rather than by the original
  // filename: two authors uploading `cover.jpg` must not be one upload, and a
  // filename is attacker-shaped input that would otherwise become a path.
  const assetId = randomUUID();
  const folder = `courses/${loaded.course.id}/${assetId}`;

  const admin = supabaseAdmin();
  const storage = admin.storage.from(BUCKET);
  const stored: string[] = [];

  for (const rendition of prepared.renditions) {
    const path = `${folder}/${rendition.name}`;
    const { error } = await storage.upload(path, rendition.bytes, {
      contentType: rendition.contentType,
      // Every path is unique, so an upsert could only ever mean a collision on a
      // uuid — which is a bug worth hearing about rather than overwriting.
      upsert: false,
      // A year: the path is content-addressed by uuid, so the bytes at it never
      // change. Replacing an image writes a new folder.
      cacheControl: "31536000",
    });

    if (error) {
      // Half an upload is worse than none: the survivors would be bytes nothing
      // references, and the sweeper would not reach them for a week.
      if (stored.length > 0) await storage.remove(stored);
      return NextResponse.json({ error: `media_upload_failed:${error.message}` }, { status: 502 });
    }
    stored.push(path);
  }

  const canonical = `${folder}/${prepared.renditions[0].name}`;

  // THE LEDGER IS WRITTEN BEFORE THE AUTHOR IS TOLD IT WORKED, and failing to
  // write it un-does the upload. The alternative — keep the bytes, lose the
  // row — is bytes that count against nobody's quota and that no usage report
  // can explain. Those are precisely what the table exists to prevent, so half
  // a success is treated as a failure.
  const ledger = await admin.from("lms_media_assets").insert({
    id: assetId,
    course_id: loaded.course.id,
    asset_key: folder,
    canonical_path: canonical,
    paths: stored,
    bytes: prepared.renditions.reduce((sum, rendition) => sum + rendition.bytes.byteLength, 0),
    content_type: prepared.renditions[0].contentType,
    width: prepared.width,
    height: prepared.height,
    uploaded_by: user.id,
  });

  if (ledger.error) {
    await storage.remove(stored);
    return NextResponse.json({ error: `media_ledger_failed:${ledger.error.message}` }, { status: 502 });
  }

  const { data } = storage.getPublicUrl(canonical);

  return NextResponse.json({
    src: data.publicUrl,
    path: canonical,
    // Reported so the field can tell the author what it did with their file
    // rather than silently handing back a different image than they picked.
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.renditions[0].bytes.byteLength,
    sourceBytes: file.size,
  });
}
