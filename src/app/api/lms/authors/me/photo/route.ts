/**
 * POST /api/lms/authors/me/photo — an author's portrait, prepared the same
 * way a course cover is (see `src/app/api/lms/authoring/media/route.ts`).
 *
 * Same bucket (`course-media`, no write policy of its own — everything routes
 * through a service-role endpoint that holds its own authority check), same
 * pipeline, different folder: `authors/<userId>/<assetId>/...` instead of
 * `courses/<courseId>/<assetId>/...`. The ledger row's `course_id` is null —
 * the column already allows that (`ON DELETE SET NULL`).
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { isEligibleAuthor } from "@/lib/lms/authors";
import { MAX_INPUT_BYTES, isPrepareFailure, prepareMedia } from "@/lib/lms/mediaPipeline";
import { LMS_MEDIA_UPLOAD } from "@/lib/lms/rateRules";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "course-media";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(req, LMS_MEDIA_UPLOAD, user.id);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  if (!(await isEligibleAuthor(user.id))) {
    return NextResponse.json({ error: "not_an_author" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "media_expected_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "media_missing_file" }, { status: 400 });
  }
  if (!TYPES.has(file.type)) {
    return NextResponse.json({ error: `media_unsupported_type:${file.type || "unknown"}` }, { status: 415 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: `media_too_large:${file.size}` }, { status: 413 });
  }

  const prepared = await prepareMedia(Buffer.from(await file.arrayBuffer()), file.type);
  if (isPrepareFailure(prepared)) {
    const status = prepared.error === "media_not_an_image" ? 415 : 413;
    return NextResponse.json({ error: prepared.error }, { status });
  }

  const assetId = randomUUID();
  const folder = `authors/${user.id}/${assetId}`;

  const admin = supabaseAdmin();
  const storage = admin.storage.from(BUCKET);
  const stored: string[] = [];

  for (const rendition of prepared.renditions) {
    const path = `${folder}/${rendition.name}`;
    const { error } = await storage.upload(path, rendition.bytes, {
      contentType: rendition.contentType,
      upsert: false,
      cacheControl: "31536000",
    });

    if (error) {
      if (stored.length > 0) await storage.remove(stored);
      return NextResponse.json({ error: `media_upload_failed:${error.message}` }, { status: 502 });
    }
    stored.push(path);
  }

  const canonical = `${folder}/${prepared.renditions[0].name}`;

  const ledger = await admin.from("lms_media_assets").insert({
    id: assetId,
    course_id: null,
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
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.renditions[0].bytes.byteLength,
    sourceBytes: file.size,
  });
}
