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
 * Verify the inbound WayForPay callback signature. Currently used in shadow mode
 * (observation/logging only). Once we confirm real callbacks pass, this becomes the
 * gate that rejects forged webhooks — the primary phantom-Purchase vector.
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
