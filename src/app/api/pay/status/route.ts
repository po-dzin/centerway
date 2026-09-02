import { NextRequest, NextResponse } from "next/server";

import { resolveReturnStatus } from "@/lib/payReturn";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Has this payment resolved yet?
 *
 * Read by `/pay/pending` while a buyer waits for the server-to-server callback
 * to land. It exists so that the waiting screen can move on by itself: before
 * this, the return handler had to decide within a second and a half and called
 * anything slower a failure.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN. One word, and never the amount, the
 * product, the buyer or the transaction. The endpoint is unauthenticated —
 * the person waiting has no session yet, and requiring one would defeat the
 * purpose — so it is built to be useless to anyone who is not already holding
 * the order reference they were just given.
 *
 * Order references carry eight random hex characters, which is thin protection
 * on its own; the rate limit below is what makes enumerating them pointless,
 * and the payload is what makes succeeding worthless.
 */
export async function GET(req: NextRequest) {
  const limit = await enforceRateLimit(req, {
    name: "pay_status",
    limit: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  const orderRef = req.nextUrl.searchParams.get("order_ref")?.trim();
  if (!orderRef) {
    return NextResponse.json({ error: "order_ref required" }, { status: 400 });
  }

  try {
    const sb = supabaseAdmin();

    const [{ data: order }, { data: payment }] = await Promise.all([
      sb.from("orders").select("status").eq("order_ref", orderRef).maybeSingle(),
      sb
        .from("payments")
        .select("raw_payload")
        .eq("order_ref", orderRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const raw = payment?.raw_payload as Record<string, unknown> | null | undefined;
    const callbackStatus = raw?.transactionStatus ?? raw?.status;

    const status = resolveReturnStatus({
      fromParams: null,
      orderStatus: (order?.status as string | null) ?? null,
      lastCallbackStatus:
        typeof callbackStatus === "string" && callbackStatus.trim() ? callbackStatus.trim() : null,
    });

    /* Never cached. The whole value of this answer is that it is the current
       one, and a CDN holding "pending" for a minute would strand the buyer on
       the waiting screen after their payment had already gone through. */
    return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("pay_status_read_failed", {
      orderRef,
      error: err instanceof Error ? err.message : String(err),
    });
    /* A read that failed is not a payment that failed. Answering `pending`
       keeps the buyer on a screen that says we are still checking, which
       remains true, instead of asserting something we could not look up. */
    return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
  }
}
