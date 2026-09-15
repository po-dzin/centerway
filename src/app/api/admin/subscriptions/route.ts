import { NextRequest, NextResponse } from "next/server";

import {
  badRequestResponse,
  forbiddenResponse,
  parseLimitOffset,
  requireAdminSession,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { parseContacts } from "@/lib/broadcasts/csv";
import { broadcastErrorResponse, canWriteBroadcasts, readJson } from "@/lib/broadcasts/http";
import {
  importSubscribers,
  isSubscriptionStatus,
  listSubscriptions,
  setSubscriptionStatus,
} from "@/lib/broadcasts/subscriptions";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** A few megabytes of CSV is tens of thousands of rows; more belongs in several files. */
const MAX_CSV_CHARS = 8_000_000;

// GET /api/admin/subscriptions?q=&status=&limit=&offset=
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
  const rawStatus = searchParams.get("status");
  if (rawStatus && !isSubscriptionStatus(rawStatus)) return badRequestResponse("status_invalid");
  const status = rawStatus && isSubscriptionStatus(rawStatus) ? rawStatus : null;
  try {
    return NextResponse.json(await listSubscriptions({ q: searchParams.get("q") ?? "", status, limit, offset }));
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_list");
  }
}

// POST /api/admin/subscriptions  { csv, source, dryRun? } — import a base
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();

  const body = await readJson(req);
  if (typeof body.csv !== "string" || !body.csv.trim()) return badRequestResponse("csv_required");
  if (body.csv.length > MAX_CSV_CHARS) return badRequestResponse("csv_too_large");

  const parsed = parseContacts(body.csv);
  const preview = {
    valid: parsed.rows.length,
    invalid: parsed.invalid,
    duplicates: parsed.duplicates,
    unsubscribed: parsed.rows.filter((row) => row.status !== "subscribed").length,
    sample: parsed.rows.slice(0, 5),
  };
  if (body.dryRun === true) return NextResponse.json({ preview });
  if (parsed.rows.length === 0) return badRequestResponse("csv_no_valid_rows");

  try {
    const result = await importSubscribers(parsed.rows, typeof body.source === "string" ? body.source : "csv_import");
    return NextResponse.json({ preview, result });
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_import");
  }
}

// PATCH /api/admin/subscriptions  { address, status } — a manual change by the owner
export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (!canWriteBroadcasts(session)) return forbiddenResponse();

  const body = await readJson(req);
  const address = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(address)) return badRequestResponse("address_invalid");
  if (!isSubscriptionStatus(body.status)) return badRequestResponse("status_invalid");
  // A complaint is the recipient's verdict, not the owner's to overturn by hand.
  if (body.status === "subscribed") {
    try {
      const outcome = await setSubscriptionStatus(address, "subscribed", {
        source: "manual",
        reason: `admin:${session.user.id}`,
        onlyFrom: ["unsubscribed", "bounced"],
      });
      return NextResponse.json(outcome);
    } catch (error) {
      return broadcastErrorResponse(error, "subscriptions_update");
    }
  }
  try {
    const outcome = await setSubscriptionStatus(address, body.status, {
      source: "manual",
      reason: `admin:${session.user.id}`,
    });
    return NextResponse.json(outcome);
  } catch (error) {
    return broadcastErrorResponse(error, "subscriptions_update");
  }
}
