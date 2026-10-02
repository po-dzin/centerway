/**
 * Who gets a lifecycle letter, and when. The words are in `lifecycleEmails.ts`.
 *
 * AT MOST ONCE, THE SAME WAY THE RECEIPT IS. Each letter leaves an `events` row
 * whose `order_ref` names the letter and its person (`welcome:<auth user>`,
 * `stream:<stage>:<date>:<email>`), checked before sending and written after the
 * provider accepted it. The Resend Idempotency-Key carries the same string, so
 * two overlapping runs cannot both deliver within a day.
 *
 * NEVER THROWS OUT OF A RUN FOR ONE PERSON. A bad address or a provider hiccup
 * is counted and skipped; the next run picks the person up again because no
 * row was written for them.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { PURCHASE_FROM, sendEmail } from "@/lib/email/resend";
import { personalUrl, platformUrl } from "@/lib/surfaces/catalog";
import { SUPPORT_BOT_URL } from "@/lib/supportBotUrl";

import { buildStreamEmail, buildWelcomeEmail, type Links, type StreamStage } from "./lifecycleEmails";

/**
 * Accounts created before the welcome letter existed are not greeted
 * retroactively: an unexpected «Вітаємо» weeks after sign-up reads as spam.
 * `WELCOME_EMAILS_SINCE` moves the line; the default is the launch day.
 */
const DEFAULT_WELCOME_SINCE = "2026-09-29T00:00:00+03:00";
/** A run looks back this far, so a missed cron tick or an outage still catches up. */
const WELCOME_LOOKBACK_MS = 3 * 24 * 3600 * 1000;

export function lifecycleLinks(): Links {
  return {
    cabinetUrl: personalUrl("/"),
    programsUrl: platformUrl("/programs"),
    doshaTestUrl: platformUrl("/dosha-test"),
    supportUrl: SUPPORT_BOT_URL,
    channelUrl: process.env.TELEGRAM_CHANNEL_URL?.trim() || null,
    streamChatUrl: process.env.TELEGRAM_STREAM_CHAT_URL?.trim() || null,
  };
}

/** The calendar date in Kyiv — where "tomorrow" and "day 1" are counted. */
export function kyivDate(now: Date, offsetDays = 0): string {
  const shifted = new Date(now.getTime() + offsetDays * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/**
 * Nothing goes out until the owner switches it on: `LIFECYCLE_EMAILS=on` in the
 * environment. A deploy alone must never start writing to real people.
 */
export function lifecycleEmailsEnabled(): boolean {
  return process.env.LIFECYCLE_EMAILS?.trim().toLowerCase() === "on";
}

const DISABLED: LifecycleRunResult = { candidates: 0, sent: 0, skipped: 0, failed: 0, disabled: true };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function alreadySent(refs: string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const db = adminClient();
  const { data, error } = await db
    .from("events")
    .select("order_ref")
    .eq("type", "lifecycle_email_sent")
    .in("order_ref", refs);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.order_ref as string));
}

async function deliver(
  ref: string,
  to: string,
  letter: { subject: string; html: string; text: string },
): Promise<boolean> {
  const result = await sendEmail({
    to,
    from: PURCHASE_FROM,
    subject: letter.subject,
    html: letter.html,
    text: letter.text,
    idempotencyKey: `lifecycle-${ref}`,
  });
  if (!result.sent) {
    console.warn("[lifecycle-email] not sent", { ref, reason: result.reason, detail: result.detail });
    return false;
  }
  const { error } = await adminClient()
    .from("events")
    .insert({
      type: "lifecycle_email_sent",
      order_ref: ref,
      payload: { provider: "resend", message_id: result.id, to },
    });
  if (error) console.warn("[lifecycle-email] sent but not recorded", { ref, error: error.message });
  return true;
}

export type LifecycleRunResult = {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  disabled?: true;
};

/** «Вітаємо в CenterWay» for every account created since the line, once. */
export async function runWelcomeEmails(now = new Date(), limit = 200): Promise<LifecycleRunResult> {
  if (!lifecycleEmailsEnabled()) return DISABLED;
  const db = adminClient();
  const since = new Date(
    Math.max(
      Date.parse(process.env.WELCOME_EMAILS_SINCE?.trim() || DEFAULT_WELCOME_SINCE),
      now.getTime() - WELCOME_LOOKBACK_MS,
    ),
  );
  const { data, error } = await db
    .from("platform_users")
    .select("auth_user_id, email, full_name, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const people = (data ?? []).filter((row) => typeof row.email === "string" && EMAIL_RE.test(row.email.trim()));
  const refOf = (authUserId: string) => `welcome:${authUserId}`;
  const sentBefore = await alreadySent(people.map((p) => refOf(p.auth_user_id)));
  const result: LifecycleRunResult = { candidates: people.length, sent: 0, skipped: 0, failed: 0 };
  const links = lifecycleLinks();

  for (const person of people) {
    const ref = refOf(person.auth_user_id);
    if (sentBefore.has(ref)) {
      result.skipped++;
      continue;
    }
    const ok = await deliver(
      ref,
      (person.email as string).trim().toLowerCase(),
      buildWelcomeEmail({ name: person.full_name, links }),
    );
    if (ok) result.sent++;
    else result.failed++;
  }
  return result;
}

type StreamRecipient = { email: string; name: string | null; programTitle: string; startsOn: string };

function ukText(value: unknown): string | null {
  const uk = value && typeof value === "object" ? (value as { uk?: unknown }).uk : null;
  return typeof uk === "string" && uk.trim() ? uk.trim() : null;
}

/**
 * Everyone whose group stream starts on `date`, from both roads in:
 *  - a PAID ORDER of a group-format offer with that start date. Scanned by
 *    order, because an enrollment only appears when the course is first opened
 *    — the people a «завтра старт» is for have usually not opened it yet;
 *  - an ENROLLMENT carrying that start date — a manual grant (the friends of the
 *    stream get theirs this way) or a buyer who has already opened the course.
 * One letter per address, whichever road found it first.
 */
export async function streamRecipients(date: string): Promise<StreamRecipient[]> {
  const db = adminClient();
  const byEmail = new Map<string, StreamRecipient>();
  const add = (email: string | null | undefined, name: string | null | undefined, programTitle: string) => {
    const clean = email?.trim().toLowerCase();
    if (!clean || !EMAIL_RE.test(clean) || byEmail.has(clean)) return;
    byEmail.set(clean, { email: clean, name: name ?? null, programTitle, startsOn: date });
  };

  const { data: offers, error: offersError } = await db
    .from("experience_offers")
    .select("id, code, label, experience_id")
    .eq("format", "group")
    .eq("cohort_starts_on", date);
  if (offersError) throw new Error(offersError.message);

  if (offers && offers.length > 0) {
    const { data: experiences } = await db
      .from("experiences")
      .select("id, title")
      .in("id", [...new Set(offers.map((o) => o.experience_id))]);
    const titleOf = new Map((experiences ?? []).map((e) => [e.id, e.title]));
    for (const offer of offers) {
      const programTitle = titleOf.get(offer.experience_id) ?? ukText(offer.label) ?? offer.code;
      const { data: orders, error } = await db
        .from("orders")
        .select("customer_id")
        .eq("status", "paid")
        .eq("offer_id", offer.id)
        .not("customer_id", "is", null);
      if (error) throw new Error(error.message);
      const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id as string))];
      if (customerIds.length === 0) continue;
      const { data: customers } = await db.from("customers").select("email, display_name").in("id", customerIds);
      for (const customer of customers ?? []) add(customer.email, customer.display_name, programTitle);
    }
  }

  const { data: enrollments, error: enrollError } = await db
    .from("lms_enrollments")
    .select("auth_user_id, course_id")
    .eq("cohort_starts_on", date)
    .eq("status", "active")
    .is("revoked_at", null);
  if (enrollError) throw new Error(enrollError.message);
  if (enrollments && enrollments.length > 0) {
    const [{ data: users }, { data: courses }] = await Promise.all([
      db
        .from("platform_users")
        .select("auth_user_id, email, full_name")
        .in("auth_user_id", [...new Set(enrollments.map((e) => e.auth_user_id))]),
      db
        .from("lms_courses")
        .select("id, title")
        .in("id", [...new Set(enrollments.map((e) => e.course_id))]),
    ]);
    const userOf = new Map((users ?? []).map((u) => [u.auth_user_id, u]));
    const courseTitle = new Map((courses ?? []).map((c) => [c.id, c.title]));
    for (const enrollment of enrollments) {
      const user = userOf.get(enrollment.auth_user_id);
      add(user?.email, user?.full_name, courseTitle.get(enrollment.course_id) ?? "Шлях 21");
    }
  }

  return [...byEmail.values()];
}

/**
 * «Завтра старт» for streams starting tomorrow, «День 1» for streams starting
 * today — both counted in Kyiv. Group formats only: a self-paced learner has
 * no shared day 1, and the daily Telegram reminder already covers their rhythm.
 */
export async function runStreamEmails(now = new Date()): Promise<Record<StreamStage, LifecycleRunResult>> {
  if (!lifecycleEmailsEnabled()) return { tomorrow: DISABLED, day1: DISABLED };
  const links = lifecycleLinks();
  const out = {} as Record<StreamStage, LifecycleRunResult>;
  for (const [stage, date] of [
    ["tomorrow", kyivDate(now, 1)],
    ["day1", kyivDate(now, 0)],
  ] as [StreamStage, string][]) {
    const recipients = await streamRecipients(date);
    const refOf = (r: StreamRecipient) => `stream:${stage}:${date}:${r.email}`;
    const sentBefore = await alreadySent(recipients.map(refOf));
    const result: LifecycleRunResult = { candidates: recipients.length, sent: 0, skipped: 0, failed: 0 };
    for (const recipient of recipients) {
      const ref = refOf(recipient);
      if (sentBefore.has(ref)) {
        result.skipped++;
        continue;
      }
      const letter = buildStreamEmail({
        stage,
        name: recipient.name,
        programTitle: recipient.programTitle,
        startsOn: date,
        links,
      });
      if (await deliver(ref, recipient.email, letter)) result.sent++;
      else result.failed++;
    }
    out[stage] = result;
  }
  return out;
}
