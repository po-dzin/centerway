/**
 * The email side of the learning reminders: the fallback for a learner the
 * Telegram nudge cannot reach.
 *
 * WHY A FALLBACK AND NOT A SECOND CHANNEL. A learner gets one nudge, not one
 * per channel (the same rule `notifyLearner` keeps). So a letter goes only
 * where Telegram found no chat to write to, and even then not to anyone with
 * a linked Telegram — someone whose bot chat failed today is a delivery
 * problem, not a reason to start writing to their inbox as well.
 *
 * WHY IT LIVES OUTSIDE `notifyLearner`. The claim tables are unique on
 * (…, channel), and the claim is per channel: an email claim has to be taken
 * and released on its own row, or a failed letter would release the Telegram
 * slot and the other way round. `notifyLearner` knows nothing about claims.
 *
 * GATED by `LIFECYCLE_EMAILS=on`, the same switch as every other letter the
 * platform sends on its own: a deploy alone must never start writing to real
 * people. Off, this does no reads and no writes.
 *
 * NEVER THROWS into the reminder pass. A mail problem is counted in the run's
 * `email` result; the Telegram pass and the cron route carry on.
 */

import type { adminClient } from "@/lib/auth/adminClient";
import { lifecycleEmailsEnabled } from "@/lib/email/lifecycleRuns";
import type { ReminderEmail } from "@/lib/email/reminderEmails";
import { PURCHASE_FROM, sendEmail } from "@/lib/email/resend";

type Db = ReturnType<typeof adminClient>;

export type ReminderEmailResult = {
  enabled: boolean;
  sent: number;
  /** Same keys as the Telegram pass: `already_sent`, `undelivered:<reason>`, … */
  skipped: Record<string, number>;
};

export function emptyEmailResult(): ReminderEmailResult {
  return { enabled: lifecycleEmailsEnabled(), sent: 0, skipped: {} };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Contact = { email: string; name: string | null };

/**
 * Where to write, or why not to.
 *
 * The ACCOUNT email first (`platform_users`): it is the one the learner signs
 * in with, so the link in the letter opens the cabinet it names. The customer
 * record's email only when the account has none.
 *
 * Suppression is the broadcast list's (`messaging_subscriptions`): an address
 * that unsubscribed, bounced or complained is not written to. Mailing people
 * who complained is what gets a sending domain blocked, and that would cost
 * the receipts too. A list we cannot read counts as "do not send" — the
 * reminder comes back on the next run; a complaint does not un-happen.
 */
async function resolveContact(db: Db, authUserId: string): Promise<{ contact: Contact } | { skip: string }> {
  const [{ data: profile }, { data: customers }] = await Promise.all([
    db.from("platform_users").select("email, full_name").eq("auth_user_id", authUserId).maybeSingle(),
    db.from("customers").select("email, display_name, tg_id").eq("auth_user_id", authUserId).limit(5),
  ]);

  if ((customers ?? []).some((row) => row.tg_id)) return { skip: "telegram_linked" };

  const candidates = [profile?.email, ...(customers ?? []).map((row) => row.email)];
  const email = candidates.map((value) => value?.trim().toLowerCase() ?? "").find((value) => EMAIL_RE.test(value));
  if (!email) return { skip: "no_email" };

  const { data: listed, error } = await db
    .from("messaging_subscriptions")
    .select("status")
    .eq("channel", "email")
    .eq("address", email)
    .maybeSingle();
  if (error) return { skip: "suppression_unreadable" };
  if (listed && listed.status !== "subscribed") return { skip: `suppressed:${listed.status}` };

  const name = profile?.full_name ?? (customers ?? []).find((row) => row.display_name)?.display_name ?? null;
  return { contact: { email, name } };
}

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * One reminder letter, at most once: resolve → claim → send → release on
 * failure, the same order the Telegram path uses, on the `email` channel row.
 *
 * Returns whether a letter went out, so the caller can treat the learner as
 * handled. Everything else lands in `result`.
 */
export async function sendReminderEmail(input: {
  db: Db;
  authUserId: string;
  result: ReminderEmailResult;
  /** Inserts the `channel: "email"` claim row; a 23505 means already sent. */
  claim: () => PromiseLike<{ error: { code?: string; message: string } | null }>;
  /** Deletes that same row. */
  release: () => PromiseLike<unknown>;
  /** Resend's at-most-once within 24 h; the claim row covers the rest. */
  idempotencyKey: string;
  build: (contact: Contact) => ReminderEmail;
}): Promise<boolean> {
  const { result } = input;
  if (!result.enabled) return false;

  let claimed = false;
  try {
    const resolved = await resolveContact(input.db, input.authUserId);
    if ("skip" in resolved) {
      bump(result.skipped, resolved.skip);
      return false;
    }

    const claim = await input.claim();
    if (claim.error) {
      bump(result.skipped, claim.error.code === "23505" ? "already_sent" : "claim_failed");
      return false;
    }
    claimed = true;

    const letter = input.build(resolved.contact);
    const sent = await sendEmail({
      to: resolved.contact.email,
      from: PURCHASE_FROM,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      idempotencyKey: input.idempotencyKey,
    });
    if (sent.sent) {
      result.sent += 1;
      return true;
    }

    console.warn("[lms-reminder-email] not sent", { key: input.idempotencyKey, reason: sent.reason });
    // Release so the learner is tried again next run rather than skipped forever.
    await input.release();
    bump(result.skipped, `undelivered:${sent.reason}`);
    return false;
  } catch (error) {
    if (claimed) await Promise.resolve(input.release()).catch(() => undefined);
    bump(result.skipped, `error:${error instanceof Error ? error.message : "unknown_error"}`);
    return false;
  }
}
