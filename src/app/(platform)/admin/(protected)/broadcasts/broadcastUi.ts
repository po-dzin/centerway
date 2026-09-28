import type { TranslationKey } from "@/lib/i18n";
import type { BroadcastStatus } from "@/lib/broadcasts/server";

/** Tone per campaign state, from the five status recipes the panel already has. */
export const BROADCAST_STATUS_BADGE_CLASS: Record<BroadcastStatus, string> = {
  draft: "cw-status-pending-badge",
  scheduled: "cw-status-running-badge",
  sending: "cw-status-running-badge",
  sent: "cw-status-success-badge",
  cancelled: "cw-status-pending-badge",
  failed: "cw-status-failed-badge",
};

export const BROADCAST_STATUS_LABEL: Record<BroadcastStatus, TranslationKey> = {
  draft: "broadcasts_status_draft",
  scheduled: "broadcasts_status_scheduled",
  sending: "broadcasts_status_sending",
  sent: "broadcasts_status_sent",
  cancelled: "broadcasts_status_cancelled",
  failed: "broadcasts_status_failed",
};

/** `{name}` placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

const ERROR_KEYS: Record<string, TranslationKey> = {
  subject_required: "broadcasts_error_subject_required",
  body_required: "broadcasts_error_body_required",
  content_required: "broadcasts_error_body_required",
  audience_required: "broadcasts_error_audience_required",
  audience_empty: "broadcasts_error_audience_empty",
  resend_not_configured: "broadcasts_error_resend_not_configured",
  cta_url_invalid: "broadcasts_error_cta_url_invalid",
  not_editable: "broadcasts_error_not_editable",
};

export async function errorFromResponse(res: Response, t: (key: TranslationKey) => string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const code = body?.error ?? String(res.status);
  const key = ERROR_KEYS[code];
  return key ? t(key) : fill(t("broadcasts_error_generic"), { code });
}
