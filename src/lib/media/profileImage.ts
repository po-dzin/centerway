/**
 * A PERSON'S OWN PICTURE, from their file to the `course-media` bucket.
 * Server-only.
 *
 * Three doors lead here and they used to be two copies of the same seventy
 * lines: the author's portrait (`/api/lms/authors/me/photo`), the author's
 * backdrop (`/api/lms/authors/me/background`) and, since 2026-10-23, the
 * account's own face from the profile hero (`/api/platform/users/me/avatar`).
 * Each door keeps its own authority check; what happens to the bytes after it
 * is this function: the course-cover pipeline (`mediaPipeline.ts` — upright,
 * EXIF and GPS dropped, WebP at 1600 and 640, an animated GIF kept as it is),
 * every rendition stored under one folder, one ledger row in
 * `lms_media_assets` so the quota sum is true, and nothing left behind when a
 * step fails.
 *
 * The folder is the caller's to name — `authors/<userId>/<uuid>`,
 * `authors/<userId>/backgrounds/<uuid>`, `accounts/<userId>/<uuid>` — and is
 * never under `courses/`, which is the only prefix the media sweep collects
 * (`src/lib/lms/mediaSweep.ts`).
 */

import { randomUUID } from "node:crypto";

import type { Db } from "@/lib/db/server";
import { MAX_INPUT_BYTES, isPrepareFailure, prepareMedia } from "@/lib/lms/mediaPipeline";

export const PROFILE_IMAGE_BUCKET = "course-media";
export const PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export type StoredProfileImage = {
  ok: true;
  src: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  sourceBytes: number;
};
export type ProfileImageFailure = { ok: false; error: string; status: number };

/** The form's `file` field, checked the way every door checks it. */
export async function readProfileImageFile(req: Request): Promise<{ ok: true; file: File } | ProfileImageFailure> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, error: "media_expected_form_data", status: 400 };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "media_missing_file", status: 400 };
  if (!PROFILE_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: `media_unsupported_type:${file.type || "unknown"}`, status: 415 };
  }
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: `media_too_large:${file.size}`, status: 413 };
  return { ok: true, file };
}

/**
 * Prepares and stores one picture under `<prefix>/<uuid>`. `prefix` has no
 * trailing slash; the uuid is this call's and is also the ledger row's id.
 */
export async function storeProfileImage(
  db: Db,
  input: { prefix: string; uploadedBy: string; file: File },
): Promise<StoredProfileImage | ProfileImageFailure> {
  const { file } = input;
  const prepared = await prepareMedia(Buffer.from(await file.arrayBuffer()), file.type);
  if (isPrepareFailure(prepared)) {
    return { ok: false, error: prepared.error, status: prepared.error === "media_not_an_image" ? 415 : 413 };
  }

  /* The pipeline always returns at least one rendition, and everything below
     reads the first one — the canonical path, the ledger's content type, the
     size reported back. An empty list would store a folder with no file in it
     and a row pointing at nothing, so it is refused before any bytes move. */
  const [primary] = prepared.renditions;
  if (!primary) return { ok: false, error: "media_prepare_empty", status: 500 };

  const assetId = randomUUID();
  const folder = `${input.prefix}/${assetId}`;
  const storage = db.storage.from(PROFILE_IMAGE_BUCKET);
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
      return { ok: false, error: `media_upload_failed:${error.message}`, status: 502 };
    }
    stored.push(path);
  }

  const canonical = `${folder}/${primary.name}`;
  const ledger = await db.from("lms_media_assets").insert({
    id: assetId,
    course_id: null,
    asset_key: folder,
    canonical_path: canonical,
    paths: stored,
    bytes: prepared.renditions.reduce((sum, rendition) => sum + rendition.bytes.byteLength, 0),
    content_type: primary.contentType,
    width: prepared.width,
    height: prepared.height,
    uploaded_by: input.uploadedBy,
  });
  if (ledger.error) {
    await storage.remove(stored);
    return { ok: false, error: `media_ledger_failed:${ledger.error.message}`, status: 502 };
  }

  return {
    ok: true,
    src: storage.getPublicUrl(canonical).data.publicUrl,
    path: canonical,
    width: prepared.width,
    height: prepared.height,
    bytes: primary.bytes.byteLength,
    sourceBytes: file.size,
  };
}
