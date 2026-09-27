import type { PayableProductCode } from "@/lib/products";

export function buildReturnUrl(appBaseUrl: string, product: PayableProductCode, orderRef: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/pay/return?product=${encodeURIComponent(product)}&order_ref=${encodeURIComponent(orderRef)}`;
}

/**
 * The one line a buyer reads on the gateway's page: the offer's description,
 * or its heading when there is none. Each gateway trims it to its own limit.
 */
export function invoiceLine(heading: string, description: string): string {
  const joined = description.trim() ? description : heading;
  return joined
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
