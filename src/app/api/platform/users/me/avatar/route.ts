/**
 * POST /api/platform/users/me/avatar — a new face, from the profile hero's
 * «Завантажити фото» (2026-10-23). Open to every signed-in account, not only
 * authors: the face is the account's, and comments, the topbar and the feed
 * read it for learners too.
 *
 * The bytes go the way an author portrait's do (`storeProfileImage`: the
 * course-cover pipeline, the `course-media` bucket, one ledger row). Where the
 * picture is then WRITTEN depends on who is asking:
 *
 *   · an account with an author profile — into the profile's `photo`, and the
 *     account follows from it (`setAuthorPhoto` → `syncAccountFromAuthor`).
 *     Writing only the account would be undone the next time the cabinet
 *     reads the profile, which re-syncs the account from it;
 *   · any other account — `cw_avatar` on the account itself
 *     (`accountMetaFromUpload`), the key a Google sign-in never overwrites.
 *
 * Either way `auth.users` changes, and the trigger from migration
 * 20261022160000 mirrors it into `platform_users`, which the comments and
 * the feed read. The caller refreshes its session so the topbar's token
 * carries the new face at once.
 */

import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { accountMetaFromUpload } from "@/lib/auth/accountIdentity";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { setAuthorPhoto } from "@/lib/lms/authors";
import { LMS_MEDIA_UPLOAD } from "@/lib/lms/rateRules";
import { readProfileImageFile, storeProfileImage } from "@/lib/media/profileImage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(req, LMS_MEDIA_UPLOAD, user.id);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  const read = await readProfileImageFile(req);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const db = adminClient();
  const { data: profile } = await db.from("lms_authors").select("id").eq("auth_user_id", user.id).maybeSingle();

  /* An author's face is filed beside their other portraits, so the folder
     says whose it is the way the author routes' folders already do. */
  const stored = await storeProfileImage(db, {
    prefix: profile ? `authors/${user.id}` : `accounts/${user.id}`,
    uploadedBy: user.id,
    file: read.file,
  });
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  if (profile) {
    const author = await setAuthorPhoto(user.id, stored.src);
    if (!author) return NextResponse.json({ error: "profile_write_failed" }, { status: 502 });
    return NextResponse.json({ src: stored.src, author });
  }

  const { error } = await db.auth.admin.updateUserById(user.id, { user_metadata: accountMetaFromUpload(stored.src) });
  if (error) return NextResponse.json({ error: "account_write_failed" }, { status: 502 });
  return NextResponse.json({ src: stored.src, author: null });
}
