import { NextRequest, NextResponse } from "next/server";

import { badRequestResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";
import { AccessError } from "@/lib/admin/access/shared";
import { adminClient } from "@/lib/auth/adminClient";
import { isFulfilmentStatus, setFulfilmentStatus } from "@/lib/admin/fulfilment";

// PATCH /api/admin/orders/fulfilment { order_ref, status, note? }
// Moves a service or parcel order along pending → scheduled → done | cancelled.
// Support may do it as well as admin: carrying out a consultation is the
// support desk's work, and the money on the order is not touched.
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as { order_ref?: unknown; status?: unknown; note?: unknown };
  if (typeof body.order_ref !== "string" || !body.order_ref.trim()) return badRequestResponse("order_ref_required");
  if (!isFulfilmentStatus(body.status)) return badRequestResponse("fulfilment_status_invalid");

  try {
    const result = await setFulfilmentStatus(adminClient(), {
      orderRef: body.order_ref.trim(),
      status: body.status,
      actorId: session.user.id,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
