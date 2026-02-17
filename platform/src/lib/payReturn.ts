import { PRODUCTS } from "@/lib/products";

export type ReturnStatus = "paid" | "failed";
export type ReturnProduct = keyof typeof PRODUCTS;

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
  const destBase = status === "paid" ? PRODUCTS[product].approvedUrl : PRODUCTS[product].declinedUrl;
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

