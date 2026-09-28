import crypto from "crypto";

import type { PaymentOutcome } from "@/lib/payments/orderStatus";

import type { PaymentGateway, SignatureCheck } from "./types";

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// WayForPay service-callback signature: HMAC-MD5 over these fields joined by ";",
// keyed with the merchant secret. Order is fixed by WayForPay's spec.
export const WFP_CALLBACK_SIGNATURE_FIELDS = [
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

export type WfpSignatureCheck = SignatureCheck;

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

/* WayForPay's own vocabulary. `Voided` sits with the refunds because the money
   goes back to the buyer either way — the difference is whether the payment had
   settled, which matters to accounting and not to entitlement. Anything not
   listed is `pending` (InProcessing, WaitingAuthComplete, RefundInProcessing):
   the payment is still moving, and a status in motion must not be written down
   as an outcome. */
const WFP_APPROVED = new Set(["approved", "success", "paid"]);
const WFP_REFUNDED = new Set(["refunded", "voided", "void"]);
const WFP_REJECTED = new Set(["declined", "expired", "failed"]);

export function wfpCallbackOutcome(payload: Record<string, string>): PaymentOutcome {
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
  nowSeconds: number = Math.floor(Date.now() / 1000),
): WfpAcceptResponse | null {
  const secret = process.env.WFP_SECRET_KEY;
  if (!secret) return null;

  const signature = crypto
    .createHmac("md5", secret)
    .update([orderReference, WFP_ACCEPT_STATUS, String(nowSeconds)].join(";"), "utf8")
    .digest("hex");

  return { orderReference, status: WFP_ACCEPT_STATUS, time: nowSeconds, signature };
}

// ─── The gateway, as the rest of the payment path sees it ──────────────────

const WFP_API_URL = "https://api.wayforpay.com/api";
const WFP_ENV = ["WFP_MERCHANT_ACCOUNT", "WFP_SECRET_KEY", "WFP_MERCHANT_DOMAIN"] as const;

/** The invoice line: WayForPay refuses a product name over 255 characters. */
export function wfpLineTitle(input: string): string {
  const flat = input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length <= 255 ? flat : `${flat.slice(0, 252)}...`;
}

/** Seconds from whichever date field this callback carries, or null. */
function callbackTime(payload: Record<string, string>): number | null {
  const candidates = [
    payload["transactionDate"],
    payload["transaction_date"],
    payload["paymentDate"],
    payload["payment_date"],
    payload["processingDate"],
    payload["processing_date"],
    payload["updatedDate"],
    payload["updated_at"],
    payload["createdDate"],
    payload["created_at"],
  ];
  for (const candidate of candidates) {
    const trimmed = norm(candidate);
    if (!trimmed) continue;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      if (numeric > 1_000_000_000_000) return Math.floor(numeric / 1000);
      if (numeric > 1_000_000_000) return Math.floor(numeric);
    }
    const parsedMs = Date.parse(trimmed);
    if (Number.isFinite(parsedMs)) return Math.floor(parsedMs / 1000);
  }
  return null;
}

function wfpAmount(payload: Record<string, string>): number | null {
  for (const key of ["amount", "paymentAmount", "orderAmount"]) {
    const value = norm(payload[key]);
    if (value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export const wayforpay: PaymentGateway = {
  id: "wfp",
  /* No transaction split: WayForPay can hold several payout accounts for ONE
     merchant, not route a payment to another merchant. Authors' parts are
     accrued in `order_shares` and paid out by hand. */
  supportsSplit: false,
  callbackPath: "/api/wfp/webhook",

  missingEnv() {
    return WFP_ENV.filter((name) => !process.env[name]);
  },

  async createInvoice(request, fetchFn) {
    if (request.splits?.length) return { ok: false, error: "gateway_split_unsupported" };

    const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT!;
    const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN!;
    const lineTitle = wfpLineTitle(request.lineTitle);
    const body: Record<string, unknown> = {
      apiVersion: 1,
      transactionType: "CREATE_INVOICE",
      merchantAccount,
      merchantDomainName,
      orderReference: request.orderRef,
      orderDate: request.orderDate,
      amount: request.amount,
      currency: request.currency,
      productName: [lineTitle],
      productPrice: [request.amount],
      productCount: [1],
      serviceUrl: request.callbackUrl,
      returnUrl: request.returnUrl,
    };
    const signString = [
      merchantAccount,
      merchantDomainName,
      request.orderRef,
      request.orderDate,
      request.amount,
      request.currency,
      lineTitle,
      "1",
      String(request.amount),
    ].join(";");
    body.merchantSignature = crypto
      .createHmac("md5", process.env.WFP_SECRET_KEY!)
      .update(signString, "utf8")
      .digest("hex");

    const response = await fetchFn(WFP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { invoiceUrl?: unknown; url?: unknown };
      const payUrl = norm(parsed.invoiceUrl) ?? norm(parsed.url);
      if (payUrl) return { ok: true, payUrl };
    } catch {
      // not JSON — reported below with the raw text
    }
    return { ok: false, error: "gateway_no_url", raw: text };
  },

  verifyCallback: verifyWfpCallbackSignature,

  readCallback(payload) {
    const orderRef = norm(payload["orderReference"] ?? payload["order_ref"]);
    if (!orderRef) return null;
    return {
      orderRef,
      outcome: wfpCallbackOutcome(payload),
      rawStatus: norm(payload["transactionStatus"] ?? payload["status"]),
      providerTxId:
        norm(payload["rrn"]) ??
        norm(payload["RRN"]) ??
        norm(payload["transactionId"]) ??
        norm(payload["payment_id"]) ??
        norm(payload["id"]),
      occurredAt: callbackTime(payload),
      amount: wfpAmount(payload),
      currency: norm(payload["currency"]) ?? norm(payload["orderCurrency"]) ?? norm(payload["paymentCurrency"]),
      payer: {
        email: norm(payload["email"]) ?? norm(payload["payerEmail"]),
        phone: norm(payload["phone"]) ?? norm(payload["payerPhone"]),
      },
      raw: payload,
    };
  },

  outcomeOf(rawStatus) {
    return wfpCallbackOutcome({ transactionStatus: rawStatus ?? "" });
  },

  storedOutcome(raw) {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const status = norm(record.transactionStatus) ?? norm(record.status);
    return status ? wfpCallbackOutcome({ transactionStatus: status }) : null;
  },

  acknowledge(orderRef, nowSeconds) {
    const accept = buildWfpAcceptResponse(orderRef, nowSeconds);
    return accept ? { status: 200, body: accept } : null;
  },
};
