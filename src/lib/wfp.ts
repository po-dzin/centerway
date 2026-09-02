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

// ─── WHAT A CALLBACK MEANS, AND WHAT IT IS ALLOWED TO DO ───────────────────

/**
 * A callback's meaning, in the only four flavours an order can act on.
 *
 * The webhook used to collapse this to a boolean — approved, or not approved —
 * and everything wrong below flowed from that one simplification. "Not
 * approved" was written to the order as `created`, which made a refund
 * indistinguishable from an abandoned cart, and, far worse, made a *late
 * declined callback* indistinguishable from an instruction to un-sell a course
 * somebody had already paid for.
 */
export type WfpCallbackOutcome = "approved" | "refunded" | "rejected" | "pending";

/**
 * The statuses `orders.status` and `payments.status` are allowed to hold.
 *
 * `ORDER_STATUSES` is the same set at runtime, because the column is free text
 * in Postgres — there is no CHECK constraint standing behind this type. Anything
 * that writes the column from outside the callback (the admin reconcile, for
 * one) has to validate against something, and it must be THIS something: a
 * second hand-written list would eventually disagree with the transition rules
 * below, and the disagreement would show up as a customer losing a course.
 */
export const ORDER_STATUSES = ["created", "paid", "refunded"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/* WayForPay's own vocabulary. `Voided` sits with the refunds because the money
   goes back to the buyer either way — the difference is whether the payment had
   settled, which matters to accounting and not to entitlement. Anything not
   listed is `pending` (InProcessing, WaitingAuthComplete, RefundInProcessing):
   the payment is still moving, and a status in motion must not be written down
   as an outcome. */
const WFP_APPROVED = new Set(["approved", "success", "paid"]);
const WFP_REFUNDED = new Set(["refunded", "voided", "void"]);
const WFP_REJECTED = new Set(["declined", "expired", "failed"]);

export function wfpCallbackOutcome(payload: Record<string, string>): WfpCallbackOutcome {
  const raw = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase() ?? "";
  if (WFP_APPROVED.has(raw)) return "approved";
  if (WFP_REFUNDED.has(raw)) return "refunded";
  if (WFP_REJECTED.has(raw)) return "rejected";
  return "pending";
}

/* `isWfpApproved` used to live here, and it is deliberately gone rather than
   rewritten on top of the classifier. It asked "approved, yes or no?", and
   answering a four-state question with a boolean is the shape of the bug this
   module now guards against: everything that was not an approval became one
   undifferentiated "not paid", which the webhook then wrote over a paid order.
   Call `wfpCallbackOutcome` and handle what it actually says. */

export function wfpEventTypeFromStatus(
  payload: Record<string, string>
): "payment_paid" | "payment_failed" | null {
  const outcome = wfpCallbackOutcome(payload);
  if (outcome === "approved") return "payment_paid";
  if (outcome === "pending") return null;
  return "payment_failed";
}

/** The status this outcome writes when nothing stands in its way. */
export function orderStatusForOutcome(outcome: WfpCallbackOutcome): OrderStatus | null {
  switch (outcome) {
    case "approved":
      return "paid";
    case "refunded":
      return "refunded";
    case "rejected":
      return "created";
    case "pending":
      return null;
  }
}

/**
 * The statuses this outcome must never overwrite — the guard, stated once so
 * that the in-memory decision and the SQL predicate cannot drift apart.
 *
 * WHY THERE HAS TO BE A GUARD AT ALL. WayForPay redelivers a service callback
 * for up to four days and promises nothing about the order they arrive in. A
 * buyer whose card is declined and who immediately retries on the same invoice
 * therefore produces two callbacks, Declined and Approved, that can land in
 * either sequence — and until 2026-08-29 we never returned the signed
 * acceptance that stops redelivery, so every one of those callbacks was
 * arriving again and again for days.
 *
 * This is not hypothetical. Four production orders (2026-04-12, 04-25, 04-27,
 * 06-12) carry exactly that pair on one order reference. They are `paid` today
 * because the approval happened to be written last. Had a redelivered Declined
 * landed after it, the old code would have written `created` over `paid`, and
 * `acceptedPaidOrders` — which asks only whether the status reads "paid" —
 * would have closed the course on a paying customer, with no event, no alert
 * and no trace of why.
 *
 * A refund is the one thing that may take access away, and once taken it is
 * final for that reference: a repeat purchase gets a new one.
 */
export function statusesProtectedFrom(outcome: WfpCallbackOutcome): OrderStatus[] {
  switch (outcome) {
    case "approved":
      return ["refunded"];
    case "rejected":
      return ["paid", "refunded"];
    case "refunded":
    case "pending":
      return [];
  }
}

/**
 * The status to write for this callback, or `null` to leave the row untouched.
 *
 * `current` is deliberately `string | null` rather than `OrderStatus`: it comes
 * out of the database, where the column is free text, and a value this function
 * does not recognise must not be treated as an empty one.
 */
export function nextOrderStatus(
  current: string | null | undefined,
  outcome: WfpCallbackOutcome
): OrderStatus | null {
  const target = orderStatusForOutcome(outcome);
  if (!target) return null;

  const held = norm(current ?? null)?.toLowerCase() ?? null;
  if (held && statusesProtectedFrom(outcome).includes(held as OrderStatus)) return null;

  return target;
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
