import crypto from "crypto";
import { secretsEqual } from "@/lib/auth/secretsEqual";

import type { PaymentOutcome } from "@/lib/payments/orderStatus";

import type { PaymentGateway, PayoutSplit, SignatureCheck } from "./types";

/**
 * LIQPAY (2026-10-03).
 *
 * The owner chose LiqPay on 2026-09-24 because it can split one payment
 * between merchants at the moment it is paid (`split_rules`): the author's
 * part lands on the author's own shop, the platform's on the platform's
 * (docs/payments/wfp-split-payments-research-2026-09-17.md, §6.1).
 *
 * The protocol, in one paragraph. Every request and every callback is a pair:
 * `data`, a base64 JSON object, and `signature`, base64(sha1(private_key +
 * data + private_key)). The checkout is our own signed link to LiqPay's page —
 * no server call is needed to issue it. The callback arrives on `server_url`
 * as a form with the same pair.
 *
 * Environment (production only, set by the owner):
 *   LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY — the shop the payment is made in;
 *   LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY   — a SECOND shop that receives the
 *     platform's part of a split. LiqPay does not let the shop that starts a
 *     split be one of its receivers, so without this one there is no split:
 *     the whole payment stays with the platform and the author's share is
 *     accrued for a manual payout, exactly as with WayForPay.
 */

const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
const LIQPAY_ENV = ["LIQPAY_PUBLIC_KEY", "LIQPAY_PRIVATE_KEY"] as const;

function norm(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function liqpaySignature(data: string, privateKey: string): string {
  return crypto
    .createHash("sha1")
    .update(privateKey + data + privateKey, "utf8")
    .digest("base64");
}

export function encodeLiqpayData(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params), "utf8").toString("base64");
}

/** The callback's fields, or null when `data` is not base64 JSON of an object. */
export function decodeLiqpayData(data: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Flat strings, so the stored payload reads the same way the WayForPay one does. */
function flatten(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return out;
}

export function verifyLiqpayCallbackSignature(payload: Record<string, string>): SignatureCheck {
  const privateKey = process.env.LIQPAY_PRIVATE_KEY;
  if (!privateKey) return { ok: false, present: false, reason: "missing_secret" };

  const data = norm(payload["data"]);
  const provided = norm(payload["signature"]);
  if (!data || !provided) return { ok: false, present: false, reason: "missing_signature" };

  const ok = secretsEqual(provided, liqpaySignature(data, privateKey));
  return { ok, present: true, reason: ok ? "match" : "mismatch" };
}

/* LiqPay's own vocabulary. Final statuses are `success`, `failure`, `error`
   and `reversed`; everything else is the payment still moving (3DS, OTP,
   `processing`, `wait_*`) and is `pending`.

   Two deliberate `pending`s:
   - `wait_accept` — the buyer's money is taken but the shop is not yet
     activated; LiqPay cancels it if activation does not happen in 90 days.
     Access opens on the `success` that follows activation, not before.
   - `sandbox` — a payment made while the shop is in test mode. No money
     moved, so it must never open access, even if test mode is switched on
     for the live shop by accident. */
const LIQPAY_APPROVED = new Set(["success"]);
const LIQPAY_REFUNDED = new Set(["reversed"]);
const LIQPAY_REJECTED = new Set(["failure", "error"]);

export function liqpayOutcome(rawStatus: string | null | undefined): PaymentOutcome {
  const raw = norm(rawStatus)?.toLowerCase() ?? "";
  if (LIQPAY_APPROVED.has(raw)) return "approved";
  if (LIQPAY_REFUNDED.has(raw)) return "refunded";
  if (LIQPAY_REJECTED.has(raw)) return "rejected";
  return "pending";
}

export type LiqpaySplitRule = {
  public_key: string;
  amount: number;
  commission_payer: "receiver";
  description: string;
};

const toKopecks = (amount: number) => Math.round(amount * 100);

/**
 * The authors' parts as they were asked for, and the platform's part as the
 * rest, so the rules always add up to the payment to the kopeck. Each receiver
 * pays the acquiring fee on its own part (`commission_payer: receiver`), the
 * same way each one fiscalises its own part.
 *
 * Null when the parts cannot be honoured: more than the payment, or nothing
 * left for the platform to receive.
 */
export function buildLiqpaySplitRules(
  splits: PayoutSplit[],
  total: number,
  platformReceiverKey: string,
  platformDescription: string,
): LiqpaySplitRule[] | null {
  const authorKopecks = splits.map((split) => toKopecks(split.amount));
  if (authorKopecks.some((k) => !Number.isFinite(k) || k <= 0)) return null;
  const restKopecks = toKopecks(total) - authorKopecks.reduce((sum, k) => sum + k, 0);
  if (restKopecks <= 0) return null;

  return [
    ...splits.map((split, index) => ({
      public_key: split.receiverRef,
      amount: (authorKopecks[index] ?? 0) / 100,
      commission_payer: "receiver" as const,
      description: split.description,
    })),
    {
      public_key: platformReceiverKey,
      amount: restKopecks / 100,
      commission_payer: "receiver" as const,
      description: platformDescription,
    },
  ];
}

/** Seconds; LiqPay reports milliseconds. */
function callbackTime(fields: Record<string, string>): number | null {
  for (const key of ["end_date", "create_date"]) {
    const value = Number(fields[key]);
    if (Number.isFinite(value) && value > 0) return value > 1_000_000_000_000 ? Math.floor(value / 1000) : value;
  }
  return null;
}

function decodedFields(payload: Record<string, string>): Record<string, string> | null {
  const data = norm(payload["data"]);
  const decoded = data ? decodeLiqpayData(data) : null;
  return decoded ? flatten(decoded) : null;
}

export const liqpay: PaymentGateway = {
  id: "liqpay",
  label: "LiqPay",

  get supportsSplit() {
    return Boolean(norm(process.env.LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY));
  },

  callbackPath: "/api/liqpay/webhook",

  missingEnv() {
    return LIQPAY_ENV.filter((name) => !process.env[name]);
  },

  async createInvoice(request) {
    const publicKey = process.env.LIQPAY_PUBLIC_KEY!;
    const privateKey = process.env.LIQPAY_PRIVATE_KEY!;

    const params: Record<string, unknown> = {
      version: 3,
      public_key: publicKey,
      action: "pay",
      amount: request.amount,
      currency: request.currency,
      description: request.lineTitle.replace(/\s+/g, " ").trim(),
      order_id: request.orderRef,
      result_url: request.returnUrl,
      server_url: request.callbackUrl,
      language: "uk",
    };

    if (request.splits?.length) {
      const platformReceiver = norm(process.env.LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY);
      if (!platformReceiver) return { ok: false, error: "gateway_split_unsupported" };
      const rules = buildLiqpaySplitRules(request.splits, request.amount, platformReceiver, "CenterWay");
      if (!rules) return { ok: false, error: "gateway_split_unsupported" };
      params.split_rules = JSON.stringify(rules);
    }

    const data = encodeLiqpayData(params);
    const signature = liqpaySignature(data, privateKey);
    const url = new URL(LIQPAY_CHECKOUT_URL);
    url.searchParams.set("data", data);
    url.searchParams.set("signature", signature);
    return { ok: true, payUrl: url.toString() };
  },

  verifyCallback: verifyLiqpayCallbackSignature,

  readCallback(payload) {
    const fields = decodedFields(payload);
    const orderRef = fields ? norm(fields["order_id"]) : null;
    if (!fields || !orderRef) return null;
    const amount = norm(fields["amount"]);
    return {
      orderRef,
      outcome: liqpayOutcome(fields["status"]),
      rawStatus: norm(fields["status"]),
      providerTxId: norm(fields["payment_id"]) ?? norm(fields["transaction_id"]) ?? norm(fields["liqpay_order_id"]),
      occurredAt: callbackTime(fields),
      amount: amount !== null && Number.isFinite(Number(amount)) ? Number(amount) : null,
      currency: norm(fields["currency"]),
      payer: {
        /* LiqPay's page asks for an email for its own receipt. Whether it is
           echoed back in the callback is not documented where we could read
           it; it is taken when it is, and the first live payment shows which. */
        email: norm(fields["sender_email"]) ?? norm(fields["email"]),
        phone: norm(fields["sender_phone"]),
      },
      raw: fields,
    };
  },

  outcomeOf: liqpayOutcome,

  storedOutcome(raw) {
    if (!raw || typeof raw !== "object") return null;
    const status = norm((raw as Record<string, unknown>).status);
    return status ? liqpayOutcome(status) : null;
  },

  /* LiqPay reads the HTTP status, not a signed body. */
  acknowledge() {
    return { status: 200, body: { ok: true } };
  },
};
