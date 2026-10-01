import { NextRequest, NextResponse } from "next/server";

import {
  badRequestResponse,
  forbiddenResponse,
  parseLimitOffset,
  requireAdminSession,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { writeAudit } from "@/lib/admin/access/shared";
import { serviceClient } from "@/lib/db/server";
import { broadcastErrorResponse, readJson } from "@/lib/broadcasts/http";
import {
  importSubscriptions,
  listSubscriptions,
  resubscribeManually,
  setSubscriptionStatus,
  subscriptionCounts,
} from "@/lib/broadcasts/server";

/**
 * The list itself: who is on it, who left and why.
 *
 * GET   ?status=&q=&limit=&offset= — rows and the per-status counts
 * POST  { text, source }           — import pasted addresses (never resubscribes anyone)
 * PATCH { address, action }        — `unsubscribe` by hand (support may: it is what a person
 *                                    asks support for), `resubscribe` an address that was
 *                                    unsubscribed by hand (admin only)
 */

const STATUSES = new Set(["", "subscribed", "unsubscribed", "bounced", "complained"]);

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim() ?? "";
  if (!STATUSES.has(status)) return badRequestResponse("status_invalid");
  const q = searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 200 });
  try {
    const [page, counts] = await Promise.all([listSubscriptions({ status, q, limit, offset }), subscriptionCounts()]);
    return NextResponse.json({ ...page, counts });
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_list");
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();
  const body = await readJson(req);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return badRequestResponse("text_required");
  if (text.length > 2_000_000) return badRequestResponse("text_too_large");
  const source = body?.source === "sendpulse_import" ? "sendpulse_import" : "csv_import";
  try {
    const result = await importSubscriptions(text, source);
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: "broadcast.subscriptions_import",
      entityType: "messaging_subscriptions",
      entityId: null,
      metadata: { source, added: result.added, existing: result.existing, invalid: result.invalid.length },
    });
    return NextResponse.json(result);
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_import");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const body = await readJson(req);
  const address = typeof body?.address === "string" ? body.address.trim().toLowerCase() : "";
  if (!address.includes("@")) return badRequestResponse("address_invalid");
  const action = body?.action;
  try {
    if (action === "unsubscribe") {
      await setSubscriptionStatus(address, "unsubscribed", { source: "manual", reason: "manual", broadcastId: null });
    } else if (action === "resubscribe") {
      if (session.role !== "admin") return forbiddenResponse();
      await resubscribeManually(address);
    } else {
      return badRequestResponse("action_invalid");
    }
    await writeAudit(serviceClient(), {
      actorId: session.user.id,
      action: `broadcast.subscription_${action}`,
      entityType: "messaging_subscriptions",
      entityId: null,
      metadata: { address },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_update");
  }
}
