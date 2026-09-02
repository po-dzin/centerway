import {
  PLATFORM_PENDING_URL,
  productProgramPath,
  productReturnUrls,
  type PayableProductCode,
} from "@/lib/products";
import { wfpCallbackOutcome } from "@/lib/wfp";

/**
 * `pending` is the state this flow was missing, and its absence was a lie told
 * to paying customers.
 *
 * The browser comes back from WayForPay in a race with the server-to-server
 * callback, and the return handler used to poll the order for 1.4 seconds and
 * then answer `failed` — which routes to a page that states, in so many words,
 * that the money was not taken. On a slow callback that sentence is false, and
 * it is read by somebody whose card has just been charged. The likely next act
 * is paying a second time.
 *
 * "Not yet confirmed" is not a synonym for "declined", and only WayForPay can
 * tell us which one it is. Until it does, we say so.
 */
export type ReturnStatus = "paid" | "failed" | "pending";

/**
 * WIDER THAN `PRODUCTS` SINCE 2026-08-22. A course out of the builder returns
 * through here too, and it has no entry in that constant. `productReturnUrls`
 * answers for both namespaces — and gives the same platform pair either way,
 * because that is where every product's confirmation lives now.
 */
export type ReturnProduct = PayableProductCode;

export type ReturnMeta = {
  rrn?: string | null;
  amount?: string | null;
  currency?: string | null;
};

/**
 * Decide what to tell the buyer, from evidence rather than from a timeout.
 *
 * The order in which these are consulted is the order of how much each one
 * actually knows:
 *
 * 1. What the gateway told the BROWSER. WayForPay puts the transaction status
 *    on the return itself, and when it is there it is first-hand and current.
 * 2. What the order says. `paid` is written only by a signature-checked
 *    callback, so it is proof. `refunded` is proof of the opposite.
 * 3. What the last stored callback said. This is the one that separates the two
 *    states the old code collapsed: if a callback has ARRIVED and it declined
 *    the payment, that is a real failure. Read through `wfpCallbackOutcome` so
 *    the gateway's vocabulary is interpreted in exactly one place.
 * 4. Otherwise nothing has come back yet, and the honest answer is `pending`.
 *
 * Note what is deliberately NOT here: elapsed time. How long we have waited is
 * a fact about us, not about the payment, and turning it into a verdict is the
 * bug this replaces.
 */
export function resolveReturnStatus(input: {
  /** The status carried on the return itself, already normalised. */
  fromParams: "paid" | "failed" | null;
  /** `orders.status`, or null when the row could not be read. */
  orderStatus: string | null;
  /** `transactionStatus` from the most recent stored callback, if any. */
  lastCallbackStatus: string | null;
}): ReturnStatus {
  if (input.fromParams) return input.fromParams;

  const orderStatus = input.orderStatus?.trim().toLowerCase() ?? null;
  if (orderStatus === "paid") return "paid";
  if (orderStatus === "refunded") return "failed";

  if (input.lastCallbackStatus) {
    const outcome = wfpCallbackOutcome({ transactionStatus: input.lastCallbackStatus });
    if (outcome === "approved") return "paid";
    if (outcome === "rejected" || outcome === "refunded") return "failed";
  }

  return "pending";
}

export function buildReturnDestination(
  status: ReturnStatus,
  product: ReturnProduct,
  orderRef: string,
  meta: ReturnMeta,
  nowMs: number
): string {
  const urls = productReturnUrls(product);

  /* A PAID COURSE GOES BACK TO ITS OWN PAGE, not to a confirmation screen.
     The offer page already knows how to show a course as owned — status,
     unlocked lessons, a button into the last one — so it is a better
     confirmation than a page whose whole content is "you paid", and it removes
     a click between the payment and the course.

     Built on the approved URL's ORIGIN rather than on a relative path or a
     configured base: `approvedUrl` is what WayForPay was told to return to and
     is already absolute, so this lands on exactly the host the invoice named.
     Everything else — bot deliveries, the herb order, and every failure —
     keeps the pages it had.

     The Purchase signal moves with the buyer: the program page fires it from
     `order_ref` below, with the same `purchase_<order_ref>` event id the
     webhook sends server-side. Losing that pairing would have Meta counting
     one payment twice, which is the reason this is a redirect target and not a
     deletion of /pay/thanks. */
  const programPath = status === "paid" ? productProgramPath(product) : null;
  /* Pending has its own page rather than borrowing the declined one. The two
     say opposite things about the buyer's money, and a shared page with a
     conditional sentence is how they would drift back together. */
  const destBase =
    status === "paid" ? urls.approvedUrl : status === "pending" ? PLATFORM_PENDING_URL : urls.declinedUrl;
  const dest = programPath ? new URL(programPath, urls.approvedUrl) : new URL(destBase);

  dest.searchParams.set("order_ref", orderRef);
  dest.searchParams.set("product", String(product));
  if (meta.rrn) {
    dest.searchParams.set("rrn", meta.rrn);
    dest.searchParams.set("payment_id", meta.rrn);
  }
  if (meta.amount) dest.searchParams.set("amount", meta.amount);
  if (meta.currency) dest.searchParams.set("currency", meta.currency);
  dest.searchParams.set("ts", String(nowMs));

  return dest.toString();
}
