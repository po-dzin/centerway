import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { writeAudit } from "@/lib/admin/access/shared";
import { serviceClient } from "@/lib/db/server";
import { autoreplyErrorResponse } from "@/lib/autoreply/http";
import { createRule, listRules } from "@/lib/autoreply/rules";
import { readJson } from "@/lib/broadcasts/http";

/** The rules. Reading is staff; writing is the owner's: a rule speaks for the brand. */

// GET /api/admin/autoreply
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json({
      rules: await listRules(),
      canEdit: session.role === "admin",
      connected: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN?.trim()),
    });
  } catch (error) {
    return autoreplyErrorResponse(error, "list");
  }
}

// POST /api/admin/autoreply — a new rule, always off
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const body = (await readJson(req)) ?? {};
  try {
    const rule = await createRule(session.user.id, body);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "autoreply.create",
      entityType: "autoreply_rule",
      entityId: rule.id,
      metadata: { name: rule.name },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return autoreplyErrorResponse(error, "create");
  }
}
