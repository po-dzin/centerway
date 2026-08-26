/**
 * CenterWay LMS core — entitlement resolution.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * Deliberately provider-agnostic: an entitlement is derived from paid orders and
 * granted access tokens, never from "WayForPay said so". Adding Stripe or a
 * merchant-of-record later is a new source value, not a rewrite (§3A.1).
 */

import { courseOfferCode } from "./offerCode";

export type EntitlementSource = "order" | "token" | "manual";

export type PaidOrderRef = {
  orderRef: string;
  /** Catalog product code, e.g. "reset-day" / "mini-detox". */
  productCode: string;
  status: string;
  createdAt: string;
};

export type AccessTokenRef = {
  orderRef: string;
  used: boolean;
  expiresAt: string | null;
};

export type EntitlementInput = {
  courseProductCodes: string[];
  orders: PaidOrderRef[];
  tokens: AccessTokenRef[];
  /** Explicit grants (admin, gift, cohort import). */
  manualGrants?: Array<{ courseSlug: string; grantedAt: string }>;
  courseSlug: string;
  now: Date;
};

export type Entitlement =
  | { entitled: false; reason: "no_paid_order" | "expired" }
  | { entitled: true; source: EntitlementSource; grantedAt: string; orderRef: string | null };

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Product codes are not stable across the funnel: the same course is sold as
 * "reset-day" on one landing and "mini-detox" in older orders. Courses declare
 * every code that grants them, and matching is case-insensitive.
 */
/**
 * The paid orders that actually grant THIS course, with dead access links
 * dropped — the same filtering `resolveEntitlement` does, exposed on its own.
 *
 * Extracted because two callers need it and must never drift: entitlement asks
 * "is there one?", and the access planner asks "which one is the newest?". Two
 * copies of the code-matching rule would have meant a course that grants on a
 * legacy funnel code but refuses to renew on it.
 */
export function acceptedPaidOrders(input: {
  courseProductCodes: string[];
  courseSlug: string;
  orders: PaidOrderRef[];
  tokens: AccessTokenRef[];
  now: Date;
}): PaidOrderRef[] {
  const accepted = new Set(
    [...input.courseProductCodes, courseOfferCode(input.courseSlug)].map(normalizeCode)
  );
  const tokenByOrderRef = new Map(input.tokens.map((token) => [token.orderRef, token]));

  return input.orders
    .filter((order) => order.status.trim().toLowerCase() === "paid")
    .filter((order) => accepted.has(normalizeCode(order.productCode)))
    .filter((order) => {
      // A paid order without a token still counts: tokens are the Telegram
      // hand-off mechanism, not the entitlement itself. An EXPIRED token,
      // though, is a hand-off that lapsed.
      const token = tokenByOrderRef.get(order.orderRef);
      return !token?.expiresAt || Date.parse(token.expiresAt) >= input.now.getTime();
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function resolveEntitlement(input: EntitlementInput): Entitlement {
  /* A course ALWAYS accepts its own offer code, listed or not.
     `course:<slug>` is what the storefront charges for a course built in the
     builder, and it is generated from the slug at checkout. If accepting it
     depended on someone having typed it into `entitlementProductCodes`, the
     first course sold from the builder would take the money and grant nothing
     — and the omission would be invisible until a buyer complained. The
     declared codes stay: they are how the OLD funnel names ("mini-detox") keep
     working. */
  const accepted = new Set(
    [...input.courseProductCodes, courseOfferCode(input.courseSlug)].map(normalizeCode)
  );

  const manual = (input.manualGrants ?? []).find((grant) => grant.courseSlug === input.courseSlug);
  if (manual) {
    return { entitled: true, source: "manual", grantedAt: manual.grantedAt, orderRef: null };
  }

  const paidOrders = input.orders
    .filter((order) => order.status.trim().toLowerCase() === "paid")
    .filter((order) => accepted.has(normalizeCode(order.productCode)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (paidOrders.length === 0) return { entitled: false, reason: "no_paid_order" };

  const tokenByOrderRef = new Map(input.tokens.map((token) => [token.orderRef, token]));

  for (const order of paidOrders) {
    const token = tokenByOrderRef.get(order.orderRef);

    // A paid order without a token still grants access: tokens are the Telegram
    // hand-off mechanism, not the entitlement itself.
    if (!token) {
      return { entitled: true, source: "order", grantedAt: order.createdAt, orderRef: order.orderRef };
    }

    if (token.expiresAt && Date.parse(token.expiresAt) < input.now.getTime()) continue;

    return { entitled: true, source: "token", grantedAt: order.createdAt, orderRef: order.orderRef };
  }

  return { entitled: false, reason: "expired" };
}

/**
 * Has this enrollment's deadline passed?
 *
 * A deadline is per enrollment, not per product: the same course can be sold
 * with a year of access to one cohort and a month to another, and support may
 * extend one person's date without touching the offer. `null` is the default
 * and means "no deadline" — most access never expires, and an empty column must
 * not read as "expired at the epoch".
 *
 * An unparseable value is treated as no deadline rather than as an expiry: a
 * malformed timestamp is a data bug, and locking a paying learner out because
 * of one is the worse of the two failures.
 */
export function isEnrollmentExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const deadline = Date.parse(expiresAt);
  return Number.isFinite(deadline) && deadline <= now.getTime();
}

/* ═════════════════════════════════════════════════════════════════════════
   ACCESS WINDOWS
   ─────────────────────────────────────────────────────────────────────────
   Entitlement above answers "was this bought?". Everything below answers the
   other question — "from when until when, and is it open right now?" — which
   the brief insists is a different system sitting on top of payment, not a
   field inside it.

   All of it is pure and date-explicit so the same rules run in the cabinet, in
   the admin panel and in a native client without a round trip.
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * How long one purchase buys.
 *
 * A union rather than `days: number | null` so "sold forever" cannot be spelled
 * the same way as "nobody configured a term" — the distinction the
 * `access_lifetime` column exists to keep (2026-08-26 migration).
 */
export type AccessRule = { lifetime: true } | { lifetime: false; days: number };

/** What an offer's two columns mean, in one place. `null` = the offer says nothing yet. */
export function accessRuleOf(input: {
  accessDays: number | null | undefined;
  accessLifetime: boolean | null | undefined;
}): AccessRule | null {
  if (input.accessLifetime === true) return { lifetime: true };
  const days = input.accessDays;
  if (typeof days === "number" && Number.isFinite(days) && days > 0) {
    return { lifetime: false, days: Math.floor(days) };
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where a window that opens at `from` closes. `null` when it does not. */
export function accessWindowEnd(from: Date, rule: AccessRule): string | null {
  if (rule.lifetime) return null;
  return new Date(from.getTime() + rule.days * DAY_MS).toISOString();
}

/**
 * The state of one enrollment right now.
 *
 * `expired` is DERIVED, never stored: the deadline in the row is the only
 * truth, so access closes the moment it passes whether or not any job has run
 * since. A stored status would be a second answer, and the two would disagree
 * for as long as the sweep was late.
 *
 * Order matters. A ban outranks everything — it is about the person, and a
 * revoked-then-expired seat must not read as merely lapsed to whoever is
 * looking at the row.
 */
export type AccessState = "active" | "expired" | "revoked" | "blocked";

export type AccessRecord = {
  status?: string | null;
  blockedAt?: string | null;
  expiresAt?: string | null;
};

export function accessStateOf(record: AccessRecord, now: Date): AccessState {
  if (record.blockedAt) return "blocked";
  if (record.status === "revoked") return "revoked";
  return isEnrollmentExpired(record.expiresAt ?? null, now) ? "expired" : "active";
}

export function isAccessOpen(record: AccessRecord, now: Date): boolean {
  return accessStateOf(record, now) === "active";
}

/** Whole days left before a window closes; `null` when it never does. Never negative. */
export function daysRemaining(expiresAt: string | null | undefined, now: Date): number | null {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, Math.ceil((deadline - now.getTime()) / DAY_MS));
}

export type AccessPlanInput = {
  /** Paid orders that this course accepts, in any order — sorted here. */
  orders: PaidOrderRef[];
  /** The offer's term. `null` — nothing configured — is treated as perpetual, see below. */
  rule: AccessRule | null;
  now: Date;
  /** The enrollment as it stands, or `null` when the learner has none yet. */
  existing: {
    orderRef: string | null;
    expiresAt: string | null;
    status?: string | null;
    revokedAt?: string | null;
    blockedAt?: string | null;
  } | null;
};

export type AccessPlan =
  /** Nothing to do: no new purchase, or the seat is banned. */
  | { grant: false; reason: "blocked" | "no_new_purchase" }
  | {
      grant: true;
      /** The window's new end. `null` means it does not end. */
      expiresAt: string | null;
      /** The purchase this window is now anchored to. */
      orderRef: string;
      /** When that purchase happened — the enrollment's provenance, not its day 1. */
      purchasedAt: string;
      /** `true` when this extends or re-opens an existing row rather than creating one. */
      renewal: boolean;
    };

/**
 * Turn purchases into a window.
 *
 * THE THREE CASES THE BRIEF ASKS FOR, and how one rule covers all of them:
 *
 *  · First purchase — the window opens at the PAYMENT and runs for the offer's
 *    term. (Day 1 of the drip is still the first opening; the two clocks are
 *    deliberately different — see `ensureEnrollment`.)
 *
 *  · Re-purchase AFTER access lapsed — the old anchor is spent, the new payment
 *    is fresh, and the window re-opens from that payment.
 *
 *  · Re-purchase BEFORE access lapses — the term is ADDED to what is left
 *    rather than replacing it. Buying early must never cost the buyer the days
 *    they had already paid for, which is the accidental reset the brief warns
 *    about (§8).
 *
 * "Fresh" is decided by time, not by a consumed-orders list: an order counts
 * when it was paid after whatever the current window is anchored to, and after
 * any revoke. That is one comparison, it needs no extra table, and a replayed
 * webhook cannot double-grant because the anchor moves with the grant.
 *
 * A missing rule (`null`) grants perpetual access. It is the pre-migration
 * behaviour and the safe direction to be wrong in: an offer whose term nobody
 * filled in must not lock out someone who has paid. The place that refuses an
 * unconfigured term is the offer tool, before anything is sold.
 */
export function planAccess(input: AccessPlanInput): AccessPlan {
  if (input.existing?.blockedAt) return { grant: false, reason: "blocked" };

  const paid = [...input.orders].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (paid.length === 0) return { grant: false, reason: "no_new_purchase" };

  const anchor = input.existing?.orderRef
    ? paid.find((order) => order.orderRef === input.existing?.orderRef)
    : undefined;

  const spentUntil = Math.max(
    anchor ? Date.parse(anchor.createdAt) : Number.NEGATIVE_INFINITY,
    input.existing?.revokedAt ? Date.parse(input.existing.revokedAt) : Number.NEGATIVE_INFINITY
  );

  const fresh = paid.filter((order) => Date.parse(order.createdAt) > spentUntil);
  if (fresh.length === 0) return { grant: false, reason: "no_new_purchase" };

  const rule = input.rule ?? { lifetime: true as const };
  const last = fresh[fresh.length - 1];

  if (rule.lifetime) {
    return {
      grant: true,
      expiresAt: null,
      orderRef: last.orderRef,
      purchasedAt: last.createdAt,
      renewal: input.existing !== null,
    };
  }

  // Stacking starts from whatever is still owed. A live window keeps its
  // remaining days; a lapsed or revoked one starts again at the payment.
  const stillOpen =
    input.existing &&
    input.existing.status !== "revoked" &&
    !isEnrollmentExpired(input.existing.expiresAt, input.now);

  let end = stillOpen && input.existing?.expiresAt
    ? Date.parse(input.existing.expiresAt)
    : Date.parse(fresh[0].createdAt);

  if (!Number.isFinite(end)) end = input.now.getTime();

  // Every fresh purchase adds its term ONTO WHATEVER IS STILL OWED AT THAT
  // PAYMENT'S OWN MOMENT, not onto a single sum anchored to the first one. A
  // February and an August purchase, 30 days apiece, are not one 60-day window
  // starting in February — that window lapses in April and the August payment
  // would buy access that had already expired before it happened. Walking the
  // purchases in order and re-anchoring on any that lands after the running
  // window has lapsed keeps every payment paying for time starting no earlier
  // than itself.
  for (const order of fresh) {
    const paidAt = Date.parse(order.createdAt);
    if (Number.isFinite(paidAt) && paidAt > end) end = paidAt;
    end += rule.days * DAY_MS;
  }

  return {
    grant: true,
    expiresAt: new Date(end).toISOString(),
    orderRef: last.orderRef,
    purchasedAt: last.createdAt,
    renewal: input.existing !== null,
  };
}
