import { productReturnUrls, type PayableProductCode } from "@/lib/products";

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
  const destBase = status === "paid" ? urls.approvedUrl : urls.declinedUrl;
  const dest = new URL(destBase);

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
