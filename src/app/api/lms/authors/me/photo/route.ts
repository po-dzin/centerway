/**
 * POST /api/lms/authors/me/photo — an author's portrait, prepared the same
 * way a course cover is (see `src/app/api/lms/authoring/media/route.ts`).
 *
 * Same bucket (`course-media`, no write policy of its own — everything routes
 * through a service-role endpoint that holds its own authority check), same
 * pipeline, different folder: `authors/<userId>/<assetId>/...` instead of
 * `courses/<courseId>/<assetId>/...`. The ledger row's `course_id` is null —
 * the column already allows that (`ON DELETE SET NULL`).
 *
 * The upload itself lives in `handleAuthorImageUpload`, shared with the
 * backdrop and the gallery.
 */

import type { NextRequest } from "next/server";

import { handleAuthorImageUpload } from "@/lib/lms/authorImageUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleAuthorImageUpload(req, "portrait");
}
