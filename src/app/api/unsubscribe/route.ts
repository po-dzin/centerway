import { NextRequest, NextResponse } from "next/server";

import { setSubscriptionStatus } from "@/lib/broadcasts/subscriptions";
import { verifyUnsubscribeToken } from "@/lib/broadcasts/unsubscribeToken";
import { log } from "@/lib/logger";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

/**
 * Leaving the list.
 *
 * POST is the only verb that changes anything. It is what a mail client sends
 * for RFC 8058 one-click unsubscribe (body `List-Unsubscribe=One-Click`), and
 * what the /unsubscribe page's button sends.
 *
 * GET NEVER UNSUBSCRIBES. Corporate mail scanners and link previewers open every
 * URL in a letter; if a GET took someone off the list, half a campaign would
 * unsubscribe itself before a person read it. A GET — an old client following
 * the header as a link — is sent to the page, where a person presses the button.
 *
 * The token is the whole authorization: it names one address and can only
 * remove that address (or put it back).
 */

function tokenFrom(req: NextRequest): string | null {
  return new URL(req.url).searchParams.get("t");
}

export async function GET(req: NextRequest) {
  const token = tokenFrom(req);
  const target = new URL("/unsubscribe", PLATFORM_ORIGIN);
  if (token) target.searchParams.set("t", token);
  return NextResponse.redirect(target, 303);
}

export async function POST(req: NextRequest) {
  let token = tokenFrom(req);
  let action: "unsubscribe" | "resubscribe" = "unsubscribe";

  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { t?: unknown; action?: unknown } | null;
    if (typeof body?.t === "string") token = body.t;
    if (body?.action === "resubscribe") action = "resubscribe";
  }

  const verdict = verifyUnsubscribeToken(token);
  if (!verdict.ok) return NextResponse.json({ error: "invalid_link" }, { status: 400 });

  try {
    const outcome =
      action === "unsubscribe"
        ? await setSubscriptionStatus(verdict.address, "unsubscribed", {
            source: "unsubscribe_link",
            reason: "unsubscribe_link",
            broadcastId: verdict.broadcastId,
            // A bounce or a complaint is a stronger «no»; do not soften it.
            onlyFrom: ["subscribed"],
          })
        : await setSubscriptionStatus(verdict.address, "subscribed", {
            source: "unsubscribe_link",
            reason: "resubscribe_link",
            // Undoing one's own unsubscribe, and nothing else.
            onlyFrom: ["unsubscribed"],
          });
    return NextResponse.json({ ok: true, status: outcome.status });
  } catch (error) {
    log.error("broadcasts.unsubscribe_failed", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "unsubscribe_failed" }, { status: 500 });
  }
}
