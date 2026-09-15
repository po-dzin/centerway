import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, canWriteBroadcasts, isUuid, readJson } from "@/lib/broadcasts/http";
import { deleteBroadcast, getBroadcast, updateBroadcast } from "@/lib/broadcasts/server";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    const found = await getBroadcast(id);
    return found ? NextResponse.json(found) : notFound();
  } catch (error) {
    return broadcastErrorResponse(error, "read");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    return NextResponse.json({ broadcast: await updateBroadcast(id, await readJson(req)) });
  } catch (error) {
    return broadcastErrorResponse(error, "update");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    await deleteBroadcast(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return broadcastErrorResponse(error, "delete");
  }
}
