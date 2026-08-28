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
