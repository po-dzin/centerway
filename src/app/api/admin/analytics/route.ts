import { NextRequest, NextResponse } from "next/server";

import { campaignBreakdownLevelFromQuery, getCachedAnalyticsPayload } from "@/lib/analytics/dashboard";
import { toDateRange } from "@/lib/analytics/range";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

/** The HTTP skin over src/lib/analytics/dashboard.ts. */
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const range = toDateRange(req.nextUrl.searchParams);
  const campaignLevel = campaignBreakdownLevelFromQuery(req.nextUrl.searchParams);
  try {
    const payload = await getCachedAnalyticsPayload(range, campaignLevel);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return serverErrorResponse(message);
  }
}
