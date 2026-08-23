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
