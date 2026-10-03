import { NextRequest, NextResponse } from "next/server";

import { toDateRange } from "@/lib/analytics/range";
import { getCachedReferralAnalytics } from "@/lib/analytics/referrals";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

export const runtime = "nodejs";

/** The HTTP skin over src/lib/analytics/referrals.ts. */
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const range = toDateRange(req.nextUrl.searchParams);
  try {
    const payload = await getCachedReferralAnalytics(range);
    return NextResponse.json(payload);
  } catch (error) {
    return serverErrorResponse(error instanceof Error ? error.message : String(error));
  }
}
