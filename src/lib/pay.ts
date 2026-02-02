import { ProductCode } from "./products";

export function buildReturnUrl(appBaseUrl: string, product: ProductCode, orderRef: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/pay/return?product=${encodeURIComponent(product)}&order_ref=${encodeURIComponent(orderRef)}`;
}

export function sanitizeWfpProductName(input: string): string {
  const noTags = input.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  if (noTags.length <= 255) return noTags;
  return `${noTags.slice(0, 252)}...`;
}

export function buildWfpProductName(heading: string, description: string): string {
  const joined = `${heading} — ${description}`;
  return sanitizeWfpProductName(joined);
}
