import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit, tooManyRequests } from "@/lib/api/rateLimit";
import { isSubscribePlacement, normalizeEmail, subscribeByForm } from "@/lib/broadcasts/subscribe";
import { serviceClient } from "@/lib/db/server";
import { log } from "@/lib/logger";
import { readAttribution } from "@/lib/referral/attribution";

export const runtime = "nodejs";

/**
 * The public subscribe form's door — the mirror of `/api/unsubscribe`.
 *
 * Body: `{ email, consent: true, source: <placement id>, company: "" }`.
 * `company` is the honeypot: a field a person never sees and a form-filling
 * bot fills in. Attribution is NOT read from the body — `ref` and UTM come from
 * the first-party cookies the proxy already keeps (lib/referral/attribution),
 * so a request cannot claim a campaign it did not arrive through.
 *
 * ONE ANSWER FOR EVERY KNOWN ADDRESS. New, already subscribed, re-subscribed,
 * bounced, complained — all `{ ok: true }`. A public endpoint that answered
 * «already subscribed» would be an oracle for whose address is on the list.
 * The honeypot gets the same answer, so a bot learns nothing from it either.
 * Only a malformed request (no consent, not an address, unknown placement) is
 * told so, because the person who sent it can fix it.
 *
 * NO LETTER (2026-10-03). Nothing is mailed from here: no confirmation, no
 * welcome. That keeps the form harmless as a weapon — typing a stranger's
 * address sends them nothing — but it also means the list cannot prove the
 * address belongs to whoever ticked the box, and the form can put back
 * someone who unsubscribed. Double opt-in (a confirmation link, the row held
 * `pending` until it is pressed) is the open decision; see
 * docs/broadcasts-2026-09-15.md.
 */

/* Per IP. A person subscribes once; ten in ten minutes is a household on one
   NAT pressing twice each, not a list being filled. */
const RATE_LIMIT = { name: "subscribe", limit: 10, windowSeconds: 600 };

/** The JSON object, or null when there is none or it is not an object. */
async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body = (await req.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, RATE_LIMIT);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const body = await readBody(req);
  if (!body) return bad("body_invalid");

  // A filled honeypot is accepted and dropped: same status, same body.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    log.info("broadcasts.subscribe_honeypot");
    return NextResponse.json({ ok: true });
  }

  if (body.consent !== true) return bad("consent_required");
  const address = normalizeEmail(body.email);
  if (!address) return bad("email_invalid");
  if (!isSubscribePlacement(body.source)) return bad("source_invalid");

  try {
    const outcome = await subscribeByForm(serviceClient(), {
      address,
      placement: body.source,
      attribution: readAttribution(req),
    });
    log.info("broadcasts.subscribe", { outcome, placement: body.source });
  } catch (error) {
    log.error("broadcasts.subscribe_failed", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: "subscribe_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
