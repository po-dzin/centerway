import { NextRequest, NextResponse } from "next/server";

import { badRequestResponse, forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { writeAudit } from "@/lib/admin/access/shared";
import { serviceClient } from "@/lib/db/server";
import { broadcastErrorResponse, readJson } from "@/lib/broadcasts/http";
import {
  cancelBroadcast,
  deleteDraft,
  duplicateBroadcast,
  getBroadcast,
  retryFailed,
  sendNextBatch,
  sendTest,
  startBroadcast,
  updateDraft,
} from "@/lib/broadcasts/server";

/**
 * One campaign: read it, edit the draft, delete the draft, and the actions.
 *
 * POST { action } is the lifecycle, one verb at a time:
 *   test       the draft to the operator's own address (or `to`)
 *   start      freeze the audience (needs `confirmCount`) and send the first batch
 *   continue   the next batch — the page calls this until nothing is pending
 *   cancel     stop; whatever is still pending is skipped
 *   retry      failed rows back to pending, then continue
 *   duplicate  a new draft with the same words and audience
 *
 * All of it is the owner's (`admin`). Support reads.
 */

type Ctx = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function idOf(ctx: Ctx): Promise<string | null> {
  const { id } = await ctx.params;
  return UUID.test(id) ? id : null;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const id = await idOf(ctx);
  if (!id) return badRequestResponse("id_invalid");
  try {
    return NextResponse.json({ broadcast: await getBroadcast(id), canEdit: session.role === "admin" });
  } catch (error) {
    return broadcastErrorResponse(error, "get");
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const id = await idOf(ctx);
  if (!id) return badRequestResponse("id_invalid");
  const body = await readJson(req);
  if (!body) return badRequestResponse("body_invalid");
  try {
    return NextResponse.json({ broadcast: await updateDraft(id, body) });
  } catch (error) {
    return broadcastErrorResponse(error, "update");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const id = await idOf(ctx);
  if (!id) return badRequestResponse("id_invalid");
  try {
    await deleteDraft(id);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "broadcast.delete",
      entityType: "broadcast",
      entityId: id,
      metadata: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return broadcastErrorResponse(error, "delete");
  }
}

const ACTIONS = ["test", "start", "continue", "cancel", "retry", "duplicate"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const id = await idOf(ctx);
  if (!id) return badRequestResponse("id_invalid");
  const body = await readJson(req);
  const action = body?.action;
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return badRequestResponse("action_invalid");
  }

  const audit = (metadata: Record<string, unknown> = {}) =>
    writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: `broadcast.${action}`,
      entityType: "broadcast",
      entityId: id,
      metadata,
    });

  try {
    switch (action as Action) {
      case "test": {
        const to = typeof body?.to === "string" && body.to.trim() ? body.to.trim() : session.user.email;
        if (!to || !to.includes("@")) return badRequestResponse("to_invalid");
        const meta = session.user.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
        const name =
          typeof meta?.full_name === "string" ? meta.full_name : typeof meta?.name === "string" ? meta.name : null;
        const sent = await sendTest(id, to, name);
        return NextResponse.json({ ok: true, to, providerId: sent.id });
      }
      case "start": {
        const confirmCount = Number(body?.confirmCount);
        if (!Number.isInteger(confirmCount) || confirmCount <= 0) return badRequestResponse("confirmCount_invalid");
        const progress = await startBroadcast(id, confirmCount);
        await audit({ confirmCount });
        return NextResponse.json(progress);
      }
      case "continue":
        return NextResponse.json(await sendNextBatch(id));
      case "cancel": {
        const progress = await cancelBroadcast(id);
        await audit();
        return NextResponse.json(progress);
      }
      case "retry": {
        const progress = await retryFailed(id);
        await audit();
        return NextResponse.json(progress);
      }
      case "duplicate": {
        const broadcast = await duplicateBroadcast(id, session.user.id);
        return NextResponse.json({ broadcast }, { status: 201 });
      }
    }
  } catch (error) {
    return broadcastErrorResponse(error, action);
  }
}
