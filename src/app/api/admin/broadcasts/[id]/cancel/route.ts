import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, canWriteBroadcasts, isUuid } from "@/lib/broadcasts/http";
import { cancelBroadcast } from "@/lib/broadcasts/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/broadcasts/[id]/cancel
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    return NextResponse.json({ broadcast: await cancelBroadcast(id) });
  } catch (error) {
    return broadcastErrorResponse(error, "cancel");
  }
}
