import { productProgramPath, productReturnUrls, type PayableProductCode } from "@/lib/products";

export type ReturnStatus = "paid" | "failed";

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
  const destBase = status === "paid" ? urls.approvedUrl : urls.declinedUrl;
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
