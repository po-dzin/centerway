// src/lib/products.ts

export const PRODUCTS = {
  short: {
    code: "short",
    title: "Short Reboot",
    amount: 1,
    currency: "UAH",
    approvedUrl: "https://reboot.centerway.net.ua/thanks",
    declinedUrl: "https://reboot.centerway.net.ua/pay-failed",
  },
  irem: {
    code: "irem",
    title: "IREM",
    amount: 2,
    currency: "UAH",
    approvedUrl: "https://irem.centerway.net.ua/thanks",
    declinedUrl: "https://irem.centerway.net.ua/pay-failed",
  },
} as const;

export type ProductCode = keyof typeof PRODUCTS;
export type ProductConfig = (typeof PRODUCTS)[ProductCode];

export function normalizeProduct(input: unknown): ProductCode | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (s === "short") return "short";
  if (s === "irem") return "irem";
  return null;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function pick(sp: SearchParams, keys: string[]): string | null {
  for (const k of keys) {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return null;
}

/**
 * Достаём продукт из query:
 * - product / code / p
 * - или из order_ref префикса: "irem_20260128_..." => "irem"
 * Фоллбек: "short"
 */
export function resolveProduct(sp: SearchParams): ProductCode {
  const qp = pick(sp, ["product", "code", "p"]);
  const orderRef = pick(sp, ["order_ref", "orderReference", "order", "oref"]);
  const fromRef = orderRef ? normalizeProduct(orderRef.split("_")[0]) : null;

  return fromRef ?? normalizeProduct(qp) ?? "short";
}

export function withQuery(baseUrl: string, params: Record<string, string | null | undefined>) {
  const u = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}