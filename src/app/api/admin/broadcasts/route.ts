import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, parseLimitOffset, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, canWriteBroadcasts, readJson } from "@/lib/broadcasts/http";
import { createBroadcast, listBroadcasts } from "@/lib/broadcasts/server";

// GET /api/admin/broadcasts?status=&limit=&offset=
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
  try {
    return NextResponse.json(await listBroadcasts({ limit, offset, status: searchParams.get("status") }));
  } catch (error) {
    return broadcastErrorResponse(error, "list");
  }
}

// POST /api/admin/broadcasts — a new draft
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  try {
    const broadcast = await createBroadcast(await readJson(req), session.user.id);
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    return broadcastErrorResponse(error, "create");
  }
}
