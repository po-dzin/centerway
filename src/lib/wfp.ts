export type WfpEventType = "payment_paid" | "payment_failed" | "payment_pending";

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
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
