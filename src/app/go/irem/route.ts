import { NextRequest, NextResponse } from "next/server";
import { issueOrReuseIremPersonalOffer } from "@/lib/landing/offers";

export const runtime = "nodejs";

const CONTROL_QUERY_PARAMS = new Set([
  "tguserid",
  "tg_user_id",
  "recipient_key",
  "campaign",
  "channel",
  "note",
  "source",
]);

function readTrimmed(searchParams: URLSearchParams, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildRecipientKey(tgUserId: string): string {
  return `tg:${tgUserId}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tgUserId = readTrimmed(url.searchParams, "tgUserId", "tg_user_id");
  const campaign = readTrimmed(url.searchParams, "campaign");
  const channel = readTrimmed(url.searchParams, "channel") ?? "telegram";
  const note = readTrimmed(url.searchParams, "note");
  const source = readTrimmed(url.searchParams, "source") ?? "smartsender";

  if (!tgUserId) {
    return NextResponse.json({ ok: false, error: "tgUserId required" }, { status: 400 });
  }
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "campaign required" }, { status: 400 });
  }

  try {
    const resolved = await issueOrReuseIremPersonalOffer({
      product: "irem",
      recipientKey: buildRecipientKey(tgUserId),
      campaign,
      channel,
      note: note ?? `dynamic:${source}`,
    });

    const destination = new URL(resolved.offer.landingUrl);
    for (const [key, value] of url.searchParams.entries()) {
      if (CONTROL_QUERY_PARAMS.has(key.toLowerCase())) continue;
      if (!destination.searchParams.has(key)) {
        destination.searchParams.set(key, value);
      }
    }

    return NextResponse.redirect(destination, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "dynamic_offer_redirect_failed";
    console.error("dynamic_offer_redirect_failed", {
      tgUserId,
      campaign,
      channel,
      source,
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
