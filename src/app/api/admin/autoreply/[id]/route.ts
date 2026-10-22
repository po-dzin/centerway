import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { writeAudit } from "@/lib/admin/access/shared";
import { serviceClient } from "@/lib/db/server";
import { autoreplyErrorResponse } from "@/lib/autoreply/http";
import { deleteRule, listEvents, updateRule } from "@/lib/autoreply/rules";
import { readJson } from "@/lib/broadcasts/http";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/autoreply/:id — the journal of one rule
export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ events: await listEvents(id) });
  } catch (error) {
    return autoreplyErrorResponse(error, "events");
  }
}

// PATCH /api/admin/autoreply/:id — edit, switch on or off
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const { id } = await ctx.params;
  const body = (await readJson(req)) ?? {};
  try {
    const rule = await updateRule(id, body);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "autoreply.update",
      entityType: "autoreply_rule",
      entityId: id,
      metadata: { enabled: rule.enabled },
    });
    return NextResponse.json({ rule });
  } catch (error) {
    return autoreplyErrorResponse(error, "update");
  }
}

// DELETE /api/admin/autoreply/:id
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const { id } = await ctx.params;
  try {
    await deleteRule(id);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "autoreply.delete",
      entityType: "autoreply_rule",
      entityId: id,
      metadata: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return autoreplyErrorResponse(error, "delete");
  }
}
