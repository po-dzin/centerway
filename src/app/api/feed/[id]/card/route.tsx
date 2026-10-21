/**
 * GET /api/feed/:id/card — the picture under a shared link to a post, 1200×630.
 * Drawn by `feedCardResponse` (src/lib/feed/card.tsx); a post that is not
 * published has no card.
 */

import type { NextRequest } from "next/server";

import { feedCardResponse } from "@/lib/feed/card";
import { readFeedPost } from "@/lib/feed/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await readFeedPost(id);
  if (!post) return new Response("not_found", { status: 404 });
  return feedCardResponse(post, req.nextUrl.origin);
}
