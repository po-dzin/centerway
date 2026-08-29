import crypto from "crypto";

export type WfpEventType = "payment_paid" | "payment_failed" | "payment_pending";

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// WayForPay service-callback signature: HMAC-MD5 over these fields joined by ";",
// keyed with the merchant secret. Order is fixed by WayForPay's spec.
const WFP_CALLBACK_SIGNATURE_FIELDS = [
  "merchantAccount",
  "orderReference",
  "amount",
  "currency",
  "authCode",
  "cardPan",
  "transactionStatus",
  "reasonCode",
] as const;

export function computeWfpCallbackSignature(payload: Record<string, string>, secret: string): string {
  const signString = WFP_CALLBACK_SIGNATURE_FIELDS.map((field) => payload[field] ?? "").join(";");
  return crypto.createHmac("md5", secret).update(signString, "utf8").digest("hex");
}

export type WfpSignatureCheck = {
  ok: boolean; // signature present AND matches
  present: boolean; // merchantSignature was included in the payload
  reason: "match" | "mismatch" | "missing_signature" | "missing_secret";
};

/**
 * Verify the inbound WayForPay callback signature. This is the gate: a callback
 * that does not carry a signature made with our merchant secret never reaches the
 * database, so a forged POST can no longer flip an order to `paid` (which would
 * grant entitlement for free and fire a phantom Purchase to Meta).
 *
 * Enforcement was turned on 2026-08-28 after replaying the formula against every
 * stored callback in `payments.raw_payload`: 758 of 758 real WayForPay calls
 * (2026-02-03 … 2026-08-22) matched, with no missing signatures. `missing_secret`
 * is treated as a refusal too — without the key we cannot tell a real call from a
 * forged one, and the same key already gates invoice creation, so its absence
 * means no payment could have been started in the first place.
 */
export function verifyWfpCallbackSignature(payload: Record<string, string>): WfpSignatureCheck {
  const secret = process.env.WFP_SECRET_KEY;
  if (!secret) return { ok: false, present: false, reason: "missing_secret" };

  const provided = norm(payload["merchantSignature"]);
  if (!provided) return { ok: false, present: false, reason: "missing_signature" };

  const expected = computeWfpCallbackSignature(payload, secret);
  const ok = provided.toLowerCase() === expected.toLowerCase();
  return { ok, present: true, reason: ok ? "match" : "mismatch" };
}

export function isWfpApproved(payload: Record<string, string>): boolean {
  const ts = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase();
  return ts === "approved" || ts === "success" || ts === "paid";
}

export function wfpEventTypeFromStatus(
  payload: Record<string, string>
): "payment_paid" | "payment_failed" | null {
  const raw = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase() ?? "";
  if (raw === "approved" || raw === "success" || raw === "paid") return "payment_paid";
  if (raw === "declined" || raw === "expired" || raw === "failed" || raw === "void" || raw === "refunded") {
    return "payment_failed";
  }
  return null;
}

// ─── The ANSWER WayForPay requires, which is not an HTTP status ─────────────

/**
 * WayForPay's service-callback protocol is two-way, and the second half was
 * missing here until 2026-08-29.
 *
 * The gateway does not read the HTTP status to decide whether we accepted a
 * callback. It reads the BODY, and the body must be exactly this shape with a
 * signature over `orderReference;status;time` keyed with the merchant secret:
 *
 *   {"orderReference":"...","status":"accept","time":1415379863,"signature":"..."}
 *
 * Anything else — including a cheerful `{"ok":true}` with a 200 — is "no
 * correct response obtained", and WayForPay then redelivers the callback for
 * up to FOUR DAYS or until it gets one.
 *
 * TWO CONSEQUENCES, BOTH WORTH STATING PLAINLY.
 *
 * 1. The old route's comment — "return 200 so the gateway does not retry
 *    forever" — described something that never happened. Returning 200 never
 *    stopped a retry, because 200 was never the signal. Every callback this
 *    integration has ever received has been redelivered on WayForPay's
 *    schedule; it was invisible because every write downstream is idempotent
 *    (`payments_provider_order_ref_ux` collapses the insert to 23505, the
 *    events insert dedupes on `contains`, both job enqueues check first, and
 *    the Telegram report is gated by `saleNotificationSent`). Harmless, and
 *    entirely by luck.
 *
 * 2. It also means the retry window is a REAL safety net we were not using on
 *    purpose. A callback whose database write failed can simply not be
 *    accepted, and WayForPay will bring it back. That is why the route now
 *    withholds this response on failure instead of returning 200 and losing
 *    the payment.
 */
export const WFP_ACCEPT_STATUS = "accept" as const;

export type WfpAcceptResponse = {
  orderReference: string;
  status: typeof WFP_ACCEPT_STATUS;
  time: number;
  signature: string;
};

/**
 * `time` is seconds, and it is signed, so it cannot be filled in later or by a
 * different clock than the one that built the signature — it is passed in for
 * tests rather than read from `Date.now()` inside, for exactly that reason.
 *
 * Returns null when the secret is absent. A caller with no key cannot produce a
 * valid acceptance, and inventing an unsigned one would be worse than staying
 * silent: WayForPay would reject it and we would have told ourselves we had
 * answered.
 */
export function buildWfpAcceptResponse(
  orderReference: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): WfpAcceptResponse | null {
  const secret = process.env.WFP_SECRET_KEY;
  if (!secret) return null;

  const signature = crypto
    .createHmac("md5", secret)
    .update([orderReference, WFP_ACCEPT_STATUS, String(nowSeconds)].join(";"), "utf8")
    .digest("hex");

  return { orderReference, status: WFP_ACCEPT_STATUS, time: nowSeconds, signature };
}
