import { after, NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, canWriteBroadcasts, isUuid, readJson } from "@/lib/broadcasts/http";
import { runBroadcastJob } from "@/lib/broadcasts/sender";
import { scheduleBroadcast } from "@/lib/broadcasts/server";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/broadcasts/[id]/send  { at?: ISO string }  — no `at` means now
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await readJson(req);
  let at: Date | null = null;
  if (typeof body.at === "string" && body.at) {
    at = new Date(body.at);
    if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "at_invalid" }, { status: 400 });
  }

  try {
    const result = await scheduleBroadcast(id, at);
    /* The queued job is the guarantee; this is only the head start. Without it
       «Надіслати зараз» would wait for the next five-minute cron tick. The job
       and this run cannot collide: rows are claimed with SKIP LOCKED, and the
       one that finds nothing left simply finishes. */
    if (result.immediate) {
      after(async () => {
        try {
          await runBroadcastJob({ broadcast_id: id });
        } catch (error) {
          log.error("broadcasts.kickoff_failed", { id, message: error instanceof Error ? error.message : String(error) });
        }
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return broadcastErrorResponse(error, "send");
  }
}
