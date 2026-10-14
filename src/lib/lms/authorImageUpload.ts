/**
 * The one upload path for an author's own images — portrait, backdrop and
 * gallery — behind the endpoints under `/api/lms/authors/me/*`.
 *
 * WHY ONE FUNCTION. The portrait and the backdrop were the same eighty lines
 * twice, already drifting in their error shapes, and the gallery would have
 * been a third copy. It is also the seam where author media leaves for
 * storage: today the `course-media` bucket, through the same pipeline and
 * ledger a course cover uses. Moving author media to another store means
 * changing this file, not three routes.
 *
 * Same gates as before, in the same order: identity, rate limit, eligibility,
 * then type and size before any bytes move.
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { isEligibleAuthor } from "@/lib/lms/authors";
import { MAX_INPUT_BYTES, isPrepareFailure, prepareMedia } from "@/lib/lms/mediaPipeline";
import { LMS_MEDIA_UPLOAD } from "@/lib/lms/rateRules";
import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "course-media";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/**
 * Where under `authors/<userId>/` an upload lands. The portrait has no shelf
 * of its own because it predates the others, and its stored paths are already
 * printed in profiles — renaming the folder would orphan them.
 */
export type AuthorImageShelf = "portrait" | "backgrounds" | "gallery";

function folderFor(userId: string, shelf: AuthorImageShelf, assetId: string): string {
  return shelf === "portrait" ? `authors/${userId}/${assetId}` : `authors/${userId}/${shelf}/${assetId}`;
}

export async function handleAuthorImageUpload(req: NextRequest, shelf: AuthorImageShelf): Promise<NextResponse> {
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

  /* The pipeline always returns at least one rendition, and everything below
     reads the first one — the canonical path, the ledger's content type, the
     size reported back. An empty list would store a folder with no file in it
     and a row pointing at nothing, so it is refused before any bytes move. */
  const [primaryRendition] = prepared.renditions;
  if (!primaryRendition) {
    return NextResponse.json({ error: "media_prepare_empty" }, { status: 500 });
  }

  const assetId = randomUUID();
  const folder = folderFor(user.id, shelf, assetId);
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

  const canonical = `${folder}/${primaryRendition.name}`;
  const ledger = await admin.from("lms_media_assets").insert({
    id: assetId,
    course_id: null,
    asset_key: folder,
    canonical_path: canonical,
    paths: stored,
    bytes: prepared.renditions.reduce((sum, rendition) => sum + rendition.bytes.byteLength, 0),
    content_type: primaryRendition.contentType,
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
    bytes: primaryRendition.bytes.byteLength,
    sourceBytes: file.size,
  });
}
