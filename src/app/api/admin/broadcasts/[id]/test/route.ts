import { NextRequest, NextResponse } from "next/server";

import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { broadcastErrorResponse, canWriteBroadcasts, isUuid, readJson } from "@/lib/broadcasts/http";
import { sendTestBroadcast } from "@/lib/broadcasts/server";

type Params = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// POST /api/admin/broadcasts/[id]/test  { email?: string } — defaults to the signed-in account
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await readJson(req);
  const to = (typeof body.email === "string" && body.email.trim() ? body.email : session.user.email ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "email_invalid" }, { status: 400 });

  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const name = typeof meta?.full_name === "string" ? meta.full_name : typeof meta?.name === "string" ? meta.name : null;

  try {
    return NextResponse.json(await sendTestBroadcast(id, to, name));
  } catch (error) {
    return broadcastErrorResponse(error, "test");
  }
}
