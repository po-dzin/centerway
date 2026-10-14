/**
 * POST /api/lms/authors/me/gallery — one photograph for the caller's gallery.
 *
 * Only photographs come through here. A gallery video is a YouTube link saved
 * with the profile, never an uploaded file (see `AuthorGalleryItem`).
 */

import type { NextRequest } from "next/server";

import { handleAuthorImageUpload } from "@/lib/lms/authorImageUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleAuthorImageUpload(req, "gallery");
}
