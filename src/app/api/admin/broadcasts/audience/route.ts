import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, readJson } from "@/lib/broadcasts/http";
import { audienceOptions, countAudience } from "@/lib/broadcasts/server";

// GET /api/admin/broadcasts/audience — what the picker can offer
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json(await audienceOptions());
  } catch (error) {
    return broadcastErrorResponse(error, "audience_options");
  }
}

// POST /api/admin/broadcasts/audience  { audience } — the live count, suppression applied
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    const body = await readJson(req);
    return NextResponse.json({ count: await countAudience(body.audience) });
  } catch (error) {
    return broadcastErrorResponse(error, "audience_count");
  }
}
