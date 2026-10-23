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

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { isEligibleAuthor } from "@/lib/lms/authors";
import { LMS_MEDIA_UPLOAD } from "@/lib/lms/rateRules";
import { readProfileImageFile, storeProfileImage } from "@/lib/media/profileImage";
import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(req, LMS_MEDIA_UPLOAD, user.id);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  if (!(await isEligibleAuthor(user.id))) {
    return NextResponse.json({ error: "not_an_author" }, { status: 403 });
  }

  /* The bytes' whole path — checks, pipeline, bucket, ledger — is shared with
     the account's own avatar door; see src/lib/media/profileImage.ts. */
  const read = await readProfileImageFile(req);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const stored = await storeProfileImage(supabaseAdmin(), {
    prefix: `authors/${user.id}`,
    uploadedBy: user.id,
    file: read.file,
  });
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  return NextResponse.json({
    src: stored.src,
    path: stored.path,
    width: stored.width,
    height: stored.height,
    bytes: stored.bytes,
    sourceBytes: stored.sourceBytes,
  });
}
