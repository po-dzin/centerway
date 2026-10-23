/**
 * POST /api/lms/authors/me/background — decorative backdrop for the caller's
 * public author profile. This stays a service-role write behind the same
 * identity, eligibility, media preparation and rate-limit gates as portraits.
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
    prefix: `authors/${user.id}/backgrounds`,
    uploadedBy: user.id,
    file: read.file,
  });
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  return NextResponse.json({ src: stored.src });
}
