export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Where the gateway sends the buyer back, for every product.
 *
 * ONE PAIR, not one pair per funnel. Each landing used to own its own
 * `/thanks` and `/pay-failed`, which meant five copies of the same contract —
 * pixel, Purchase event id, client signal, order line, destination — drifting
 * apart file by file. The confirmation is a platform surface: it is where a
 * purchase becomes an entitlement, and the entitlement lives here.
 *
 * The apex host is `www` on purpose. It is what `WFP_MERCHANT_DOMAIN`, the
 * sitemap and the OG metadataBase already name, and the proxy 308s the bare
 * form onto it — a redirect in the middle of a payment return is a step that
 * can only lose people.
 *
 * The static pages under `src/landing-static/<brand>/thanks.html` STAY. WayForPay
 * stores the return URL with the invoice, so a payment started before this
 * shipped still comes back to the old address.
 */
export const PLATFORM_THANKS_URL = "https://www.centerway.net.ua/pay/thanks";
export const PLATFORM_FAILED_URL = "https://www.centerway.net.ua/pay/failed";
/**
 * Where a buyer waits while we do not yet know.
 *
 * Not per-product, unlike the pair above, because there is nothing
 * product-shaped about not knowing yet — and because every product's approved
 * and declined URLs already resolve to the same platform pages anyway.
 */
export const PLATFORM_PENDING_URL = "https://www.centerway.net.ua/pay/pending";

/**
 * Anything that can be charged for: an offer's own code, as `experience_offers`
 * carries it — `course:<slug>`, `way21-group`, `way21-support`. A plain string
 * since the codes became one channel: the only way to get a payable code is
 * `loadPayableOffer`, which resolved it against the table.
 */
export type PayableProductCode = string;
export type ProductCode = string;
export type Locale = "uk" | "en";

const DEFAULT_LOCALE: Locale = "en";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export type ProductFulfilment =
  /**
   * The platform serves it.
   *
   * TWO SLUGS, because they answer two questions and are not always the same
   * string. `courseSlug` is the row — it addresses `/learn/<courseSlug>`, where
   * the buyer reads the thing. `programSlug` is where the offer is SOLD, and it
   * is what a buyer returning from the gateway is sent to. They differ for
   * `short` (/programs/reboot) and `irem-gymnastics` (/programs/irem), whose
   * public names are years older than their rows.
   */
  | { kind: "course"; courseSlug: string; programSlug?: string }
  /**
   * A Telegram bot delivers it. NOTHING DECLARES THIS ANY MORE (2026-08-29):
   * Short Reboot and IREM were the last two, and both moved onto the platform —
   * one place to read a course, one place a receipt can point at.
   *
   * Kept rather than deleted, and the distinction is worth being exact about:
   * fulfilment is derived from the offer's thing (`offerFulfilment`), which
   * never produces this shape — the receipt email and the pay-status page
   * branch on it and that branch is unreachable. It stays because "delivered somewhere else
   * entirely" is a real third answer that a future product may need, and the
   * two surfaces already render it correctly.
   */
  | { kind: "bot"; url: string }
  | { kind: "cabinet" };

/**
 * Everything a payment needs to know about the thing being sold.
 *
 * WHY THIS TYPE EXISTS. Until 2026-08-22 the payment path indexed a constant
 * table of six products by code. Prices now live in `experience_offers`, set
 * by the owner and read at request time (2026-09-26: the constant table is
 * gone), so the surfaces take the RESOLVED facts — see `loadPayableOffer` in
 * src/lib/platform/offers.ts.
 *
 * `listAmount` is what a page may PRINT and `amount` is what is charged. They
 * are separate fields so a QA price can be set on one without the page
 * advertising it. `null` means no agreed price, and a surface that must show
 * one has to say so.
 */
export type PayableOffer = {
  code: PayableProductCode;
  heading: Record<Locale, string>;
  description: Record<Locale, string>;
  amount: number;
  listAmount: number | null;
  currency: string;
  pixelContentName: string;
  fulfilment: ProductFulfilment;
  approvedUrl: string;
  declinedUrl: string;
};

export function offerHeading(offer: PayableOffer, locale: Locale): string {
  return offer.heading[locale] ?? offer.heading[DEFAULT_LOCALE];
}

export function offerDescription(offer: PayableOffer, locale: Locale): string {
  return offer.description[locale] ?? offer.description[DEFAULT_LOCALE];
}

/** "4 100 ₴" — one formatter, so the figure reads the same on every surface. */
export function formatPrice(amount: number, currency: string = "UAH"): string {
  const grouped = amount.toLocaleString("uk-UA").replace(/\u00a0/g, "\u202f");
  return currency === "UAH" ? `${grouped} \u20b4` : `${grouped} ${currency}`;
}

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === "ua" || s === "uk" || s === "uk-ua" || s === "ua-ua") return "uk";
  if (s === "en" || s.startsWith("en-")) return "en";
  return null;
}

/**
 * Достаём order_ref из searchParams, если есть
 */
export function resolveOrderRef(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const sp = input as SearchParams;
  const raw = first(sp.order_ref) ?? first(sp.orderReference);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
