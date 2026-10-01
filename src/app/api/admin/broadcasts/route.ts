import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, readJson } from "@/lib/broadcasts/http";
import { createBroadcast, listBroadcasts } from "@/lib/broadcasts/server";
import { writeAudit } from "@/lib/admin/access/shared";
import { serviceClient } from "@/lib/db/server";

/**
 * The campaigns. Reading is staff; writing is the owner's (`admin`) — a
 * broadcast speaks for the brand to everyone on the list at once.
 */

// GET /api/admin/broadcasts
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json({ broadcasts: await listBroadcasts(), canEdit: session.role === "admin" });
  } catch (error) {
    return broadcastErrorResponse(error, "list");
  }
}

// POST /api/admin/broadcasts — a new draft
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const body = (await readJson(req)) ?? {};
  try {
    const broadcast = await createBroadcast(session.user.id, body);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "broadcast.create",
      entityType: "broadcast",
      entityId: broadcast.id,
      metadata: { title: broadcast.title },
    });
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    return broadcastErrorResponse(error, "create");
  }
}
