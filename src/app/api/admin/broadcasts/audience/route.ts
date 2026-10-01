import { NextRequest, NextResponse } from "next/server";

import { badRequestResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { parseAudience } from "@/lib/broadcasts/audience";
import { broadcastErrorResponse, readJson } from "@/lib/broadcasts/http";
import { audienceOptions, countAudience, sampleAudience } from "@/lib/broadcasts/server";

/**
 * The audience editor's two questions.
 *
 * GET  — what can I choose from: products people paid for, courses, tags, sources.
 * POST — how many people does this rule mean, and who are a few of them.
 *        The same SQL function the send freezes, so the number on screen is
 *        the number that goes out.
 */

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json(await audienceOptions());
  } catch (error) {
    return broadcastErrorResponse(error, "audience_options");
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const body = await readJson(req);
  const audience = parseAudience(body?.audience);
  if (!audience) return badRequestResponse("audience_invalid");
  try {
    const [count, sample] = await Promise.all([countAudience(audience), sampleAudience(audience, 8)]);
    return NextResponse.json({ count, sample });
  } catch (error) {
    return broadcastErrorResponse(error, "audience_count");
  }
}
