/**
 * The one place that hands an email to Resend.
 *
 * NO SDK. This is a single POST with a bearer token, and `resend` the npm
 * package would be a dependency, a version to keep current and a second way to
 * describe a request we already know how to make. `fetch` is in the runtime.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: throw. Every caller is on a path where
 * the email is the LAST thing that happens and the least important — a payment
 * has already been recorded, an order already granted. A provider outage must
 * never turn a completed purchase into a failed webhook, so failures come back
 * as a value and the caller decides. The one thing that would be worse than not
 * sending is losing the sale to a 500 from a mail API.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * `info@` on the SENDING SUBDOMAIN, not on the root domain.
 *
 * `send.centerway.net.ua` is what Resend verified (DKIM + SPF + a bounce MX two
 * levels down at `send.send`). The root keeps its own MX pointing at the
 * registrar's mailbox, untouched — so transactional mail and the human inbox
 * cannot damage each other's reputation, and marketing sent from elsewhere
 * cannot damage either.
 *
 * Replies land on an address nobody reads, which is why `replyTo` exists below
 * and why the message body sends people to the support bot instead.
 */
export const PURCHASE_FROM = "CenterWay <info@send.centerway.net.ua>";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  /**
   * Makes the SEND itself at-most-once, at the provider.
   *
   * A caller that checks "did I already send this?" and then sends has a window
   * between the two in which a second caller can check and send as well. No
   * amount of care on our side closes it without a lock; Resend closes it by
   * refusing to deliver twice for the same key.
   *
   * Max 256 characters, and the key EXPIRES AFTER 24 HOURS — so this is the
   * answer to concurrency, which is measured in seconds, and not to a repeat
   * days later. The caller still needs its own record for that.
   */
  idempotencyKey?: string;
  /** Extra MIME headers — the broadcast path sets List-Unsubscribe here. */
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "missing_api_key" | "provider_error" | "network_error"; detail?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_api_key" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: input.from ?? PURCHASE_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        // Both parts, always. A text/plain alternative is not politeness: a
        // message that is HTML only scores worse with spam filters, and the
        // access link has to survive a client that refuses to render HTML.
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: "provider_error", detail: `${response.status} ${detail.slice(0, 300)}` };
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: body?.id ?? "unknown" };
  } catch (error) {
    return {
      sent: false,
      reason: "network_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export type BatchEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export type SendBatchResult =
  | { sent: true; ids: string[] }
  | {
      sent: false;
      reason: "missing_api_key" | "provider_error" | "network_error" | "rate_limited";
      detail?: string;
    };

/** Resend's ceiling for one batch call. */
export const RESEND_BATCH_MAX = 100;

/**
 * Up to 100 messages in one request — the broadcast path.
 *
 * Same no-throw contract as `sendEmail`. The result ids come back in the order
 * the messages went in; that ordering is what lets the caller tie a provider id
 * to a recipient row, so a response that does not carry one id per message is
 * treated as a failure rather than guessed at.
 *
 * `rate_limited` is separated from other provider errors because the right
 * answer to it is to stop this run and try later, not to mark anyone failed.
 */
export async function sendEmailBatch(emails: BatchEmail[], idempotencyKey?: string): Promise<SendBatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_api_key" };
  if (emails.length === 0) return { sent: true, ids: [] };
  if (emails.length > RESEND_BATCH_MAX) {
    return { sent: false, reason: "provider_error", detail: `batch_too_large:${emails.length}` };
  }

  try {
    const response = await fetch(`${RESEND_ENDPOINT}/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify(
        emails.map((email) => ({
          from: email.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          ...(email.headers ? { headers: email.headers } : {}),
        })),
      ),
    });

    if (response.status === 429) {
      return { sent: false, reason: "rate_limited", detail: await response.text().catch(() => "") };
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: "provider_error", detail: `${response.status} ${detail.slice(0, 300)}` };
    }

    const body = (await response.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    const ids = (body?.data ?? []).map((entry) => entry?.id ?? "");
    if (ids.length !== emails.length || ids.some((id) => !id)) {
      return { sent: false, reason: "provider_error", detail: "batch_response_mismatch" };
    }
    return { sent: true, ids };
  } catch (error) {
    return {
      sent: false,
      reason: "network_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
