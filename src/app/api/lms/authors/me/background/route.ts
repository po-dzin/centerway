/**
 * POST /api/lms/authors/me/background — decorative backdrop for the caller's
 * public author profile. This stays a service-role write behind the same
 * identity, eligibility, media preparation and rate-limit gates as portraits —
 * the same function, in fact: `handleAuthorImageUpload`.
 */

import type { NextRequest } from "next/server";

import { handleAuthorImageUpload } from "@/lib/lms/authorImageUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleAuthorImageUpload(req, "backgrounds");
}
