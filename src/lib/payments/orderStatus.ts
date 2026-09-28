/**
 * WHAT A PAYMENT MEANS FOR AN ORDER, whichever gateway reported it.
 *
 * Moved out of the WayForPay module on 2026-09-26, when the gateway became a
 * swappable boundary (`./gateway`). A gateway translates its own vocabulary
 * into a `PaymentOutcome`; everything below — which status an order may hold,
 * what an outcome may overwrite — is ours, and does not change with the
 * provider.
 */

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * A callback's meaning, in the only four flavours an order can act on.
 *
 * The webhook used to collapse this to a boolean — approved, or not approved —
 * and everything wrong below flowed from that one simplification. "Not
 * approved" was written to the order as `created`, which made a refund
 * indistinguishable from an abandoned cart, and, far worse, made a *late
 * declined callback* indistinguishable from an instruction to un-sell a course
 * somebody had already paid for.
 */
export type PaymentOutcome = "approved" | "refunded" | "rejected" | "pending";

/**
 * The statuses `orders.status` and `payments.status` are allowed to hold.
 *
 * `ORDER_STATUSES` is the same set at runtime, because the column is free text
 * in Postgres — there is no CHECK constraint standing behind this type. Anything
 * that writes the column from outside the callback (the admin reconcile, for
 * one) has to validate against something, and it must be THIS something: a
 * second hand-written list would eventually disagree with the transition rules
 * below, and the disagreement would show up as a customer losing a course.
 */
export const ORDER_STATUSES = ["created", "paid", "refunded"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** The status this outcome writes when nothing stands in its way. */
export function orderStatusForOutcome(outcome: PaymentOutcome): OrderStatus | null {
  switch (outcome) {
    case "approved":
      return "paid";
    case "refunded":
      return "refunded";
    case "rejected":
      return "created";
    case "pending":
      return null;
  }
}

/**
 * The statuses this outcome must never overwrite — the guard, stated once so
 * that the in-memory decision and the SQL predicate cannot drift apart.
 *
 * WHY THERE HAS TO BE A GUARD AT ALL. A gateway redelivers a service callback
 * (WayForPay: for up to four days) and promises nothing about the order they arrive in. A
 * buyer whose card is declined and who immediately retries on the same invoice
 * therefore produces two callbacks, Declined and Approved, that can land in
 * either sequence — and until 2026-08-29 we never returned the signed
 * acceptance that stops redelivery, so every one of those callbacks was
 * arriving again and again for days.
 *
 * This is not hypothetical. Four production orders (2026-04-12, 04-25, 04-27,
 * 06-12) carry exactly that pair on one order reference. They are `paid` today
 * because the approval happened to be written last. Had a redelivered Declined
 * landed after it, the old code would have written `created` over `paid`, and
 * `acceptedPaidOrders` — which asks only whether the status reads "paid" —
 * would have closed the course on a paying customer, with no event, no alert
 * and no trace of why.
 *
 * A refund is the one thing that may take access away, and once taken it is
 * final for that reference: a repeat purchase gets a new one.
 */
export function statusesProtectedFrom(outcome: PaymentOutcome): OrderStatus[] {
  switch (outcome) {
    case "approved":
      return ["refunded"];
    case "rejected":
      return ["paid", "refunded"];
    case "refunded":
    case "pending":
      return [];
  }
}

/**
 * The status to write for this callback, or `null` to leave the row untouched.
 *
 * `current` is deliberately `string | null` rather than `OrderStatus`: it comes
 * out of the database, where the column is free text, and a value this function
 * does not recognise must not be treated as an empty one.
 */
export function nextOrderStatus(current: string | null | undefined, outcome: PaymentOutcome): OrderStatus | null {
  const target = orderStatusForOutcome(outcome);
  if (!target) return null;

  const held = norm(current ?? null)?.toLowerCase() ?? null;
  if (held && statusesProtectedFrom(outcome).includes(held as OrderStatus)) return null;

  return target;
}

/** The `events` row a callback writes: an event reports what arrived, not what we did about it. */
export function eventTypeForOutcome(outcome: PaymentOutcome): "payment_paid" | "payment_failed" | null {
  if (outcome === "approved") return "payment_paid";
  if (outcome === "pending") return null;
  return "payment_failed";
}
