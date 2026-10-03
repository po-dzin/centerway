/**
 * The public way IN to the list — the mirror of the unsubscribe link.
 *
 * Schema: supabase/migrations/20260915000000_broadcasts.sql (the table) and
 * 20261003000000_messaging_subscription_consent.sql (the consent columns).
 * Door: src/app/api/subscribe/route.ts. Form: src/components/platform/SubscribeForm.tsx.
 *
 * WHAT A TICKED BOX MAY CHANGE, by the row it lands on:
 *
 *   no row        → a new `subscribed` row, `source` = `form_<placement>`.
 *   subscribed    → stays subscribed; the consent is refreshed, `source` kept.
 *   unsubscribed  → subscribed again. The person said no once and is now
 *                   explicitly saying yes; that is theirs to change.
 *   bounced       → untouched. The address does not accept mail; a form cannot
 *                   make it.
 *   complained    → untouched. A spam report is the strongest no the list
 *                   holds, and an unauthenticated form is not enough to undo it.
 *
 * Whatever happened, the caller answers the same thing. The form is public and
 * unauthenticated, so its answer must not say whether an address is known.
 *
 * NO LETTER IS SENT from here (2026-10-03). See the route for why that is a
 * decision still open (double opt-in), not an oversight.
 */

import type { Db } from "@/lib/db/server";
import type { Insert, Json, Update } from "@/lib/db/types";
import type { Attribution } from "@/lib/referral/attribution";

/** Where a subscribe form may sit. A placement is an id in code, not free text from the request. */
export const SUBSCRIBE_PLACEMENTS = ["footer"] as const;
export type SubscribePlacement = (typeof SUBSCRIBE_PLACEMENTS)[number];

export function isSubscribePlacement(value: unknown): value is SubscribePlacement {
  return typeof value === "string" && (SUBSCRIBE_PLACEMENTS as readonly string[]).includes(value);
}

/** The row's `source` for a form placement — the audience editor filters on it. */
export function subscribeSource(placement: SubscribePlacement): string {
  return `form_${placement}`;
}

/* The same shape `parseImport` in server.ts accepts, plus the RFC 5321 length
   cap: an address longer than 254 characters cannot be delivered to, and a
   public endpoint should not store one. */
const EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/;
const EMAIL_MAX = 254;

/** Trimmed and lowercased — the form the table's CHECK holds — or null when it is not an address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  if (!address || address.length > EMAIL_MAX || !EMAIL.test(address)) return null;
  return address;
}

export type SubscribeOutcome = "created" | "refreshed" | "resubscribed" | "suppressed";

type ConsentFields = {
  consented_at: string;
  consent_source: SubscribePlacement;
  attribution: Json | null;
};

const CONSENT_KEYS = ["consented_at", "consent_source", "attribution"] as const;

/* The generated types (src/lib/db/database.types.ts) are read from production,
   which does not have the consent columns until 20261003000000 is applied; the
   client rejects keys it does not know. The rows are therefore handed over as
   the generated shape. Drop these two casts when `npm run db:types` has been
   re-run after the migration. */
const asUpdate = (row: Update<"messaging_subscriptions"> & Partial<ConsentFields>) =>
  row as Update<"messaging_subscriptions">;
const asInsert = (row: Insert<"messaging_subscriptions"> & Partial<ConsentFields>) =>
  row as Insert<"messaging_subscriptions">;

/* A database that has not run 20261003000000 yet answers a write naming the
   consent columns with PostgREST's PGRST204 («could not find the column») or
   Postgres's 42703. The subscription matters more than its paperwork, so the
   write is retried without them rather than failing the person. */
function missingConsentColumn(error: { code?: string; message: string }): boolean {
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column/i.test(error.message) && CONSENT_KEYS.some((key) => error.message.includes(key));
}

function withoutConsent<T extends Record<string, unknown>>(row: T): Omit<T, (typeof CONSENT_KEYS)[number]> {
  const copy: Record<string, unknown> = { ...row };
  for (const key of CONSENT_KEYS) delete copy[key];
  return copy as Omit<T, (typeof CONSENT_KEYS)[number]>;
}

function attributionJson(attribution: Attribution | null): Json | null {
  if (!attribution || (!attribution.ref && !attribution.utm)) return null;
  return { ref: attribution.ref, utm: attribution.utm ?? null } as Json;
}

export class SubscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscribeError";
  }
}

/**
 * Put `address` on the email list with a fresh consent. Re-running it with the
 * same input changes nothing but the consent timestamp — the idempotence the
 * form needs when a person presses the button twice.
 */
export async function subscribeByForm(
  db: Db,
  input: { address: string; placement: SubscribePlacement; attribution: Attribution | null },
  now: () => Date = () => new Date(),
): Promise<SubscribeOutcome> {
  const stamp = now().toISOString();
  const consent: ConsentFields = {
    consented_at: stamp,
    consent_source: input.placement,
    attribution: attributionJson(input.attribution),
  };

  // Two tries: the second is for the one race there is — the same address
  // inserted by a parallel request between our read and our insert.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error: readError } = await db
      .from("messaging_subscriptions")
      .select("id, status")
      .eq("channel", "email")
      .eq("address", input.address)
      .maybeSingle();
    if (readError) throw new SubscribeError(readError.message);

    if (existing) {
      if (existing.status === "bounced" || existing.status === "complained") return "suppressed";
      const resubscribe = existing.status !== "subscribed";
      const patch = {
        ...consent,
        updated_at: stamp,
        ...(resubscribe
          ? {
              status: "subscribed",
              status_reason: "subscribe_form",
              status_broadcast_id: null,
              status_changed_at: stamp,
            }
          : {}),
      };
      let { error } = await db.from("messaging_subscriptions").update(asUpdate(patch)).eq("id", existing.id);
      if (error && missingConsentColumn(error)) {
        ({ error } = await db.from("messaging_subscriptions").update(withoutConsent(patch)).eq("id", existing.id));
      }
      if (error) throw new SubscribeError(error.message);
      return resubscribe ? "resubscribed" : "refreshed";
    }

    const row: Insert<"messaging_subscriptions"> & ConsentFields = {
      channel: "email",
      address: input.address,
      status: "subscribed",
      source: subscribeSource(input.placement),
      status_reason: "subscribe_form",
      status_changed_at: stamp,
      ...consent,
    };
    let { error } = await db.from("messaging_subscriptions").insert(asInsert(row));
    if (error && missingConsentColumn(error)) {
      ({ error } = await db.from("messaging_subscriptions").insert(withoutConsent(row)));
    }
    if (!error) return "created";
    if (error.code === "23505" && attempt === 0) continue;
    throw new SubscribeError(error.message);
  }
  throw new SubscribeError("subscribe_conflict_unresolved");
}
