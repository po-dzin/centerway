export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Where WayForPay sends the buyer back, for every product.
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
 * WHAT `amount` STILL MEANS HERE, since 2026-09-03: a fallback, and for most
 * entries not even that.
 *
 * The charged sum is read from the database — `lms_course_offers` for a
 * product that names a course, `product_offers` for one that does not — by
 * `loadPayableOffer` in src/lib/platform/offers.ts, and that is the only entry
 * the checkout has. A course code with no row REFUSES the sale rather than
 * falling back here (offerAlias.test.ts asserts it), and a non-course code
 * falls back only when `listAmount` names a price. So the figures below are
 * charged in exactly one case: `way21-support` with its row missing.
 *
 * A 1 ₴ QA placeholder lived in these fields from 2026-08-21 to 2026-09-10,
 * with a comment promising it was safe because "the charged sum is always read
 * from PRODUCTS[...].amount". That stopped being true on 09-03 and the
 * placeholder outlived its own reason. Each `amount` now equals the price the
 * product was last sold for, so the constant never quotes one figure and
 * carries another.
 */

/**
 * Where a paid product is actually delivered, and what Meta should call it.
 *
 * `fulfilment` used to live nowhere: it was a hard-coded href and a
 * `redirectTarget` constant inside each of the five static thanks pages, which
 * is why the same purchase could send one buyer to a bot and another to a
 * cabinet with no single place saying so. Three shapes, and they are the three
 * real ones:
 *
 *   course  — the platform serves it; the buyer goes to /learn/<slug>
 *   bot     — a Telegram bot delivered it. Nothing does any more, since
 *             2026-08-29: the last two moved onto the platform.
 *   cabinet — no course of its own; the purchase exists in /profile
 *
 * `pixelContentName` is kept verbatim from the strings the landings sent, not
 * rewritten to something tidier: it is a REPORTING LABEL in Meta, and renaming
 * it splits one product's history into two lines.
 */
export const PRODUCTS = {
  short: {
    heading: {
      uk: "Short Reboot — онлайн-курс",
      en: "Short Reboot — online course",
    },
    description: {
      uk: 'Оплата онлайн-курсу "Short Reboot" від CenterWay. Після успішної оплати курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
      en: "Online course payment by CenterWay. After successful payment the course opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help.",
    },
    amount: 795,
    listAmount: 795,
    currency: "UAH",
    pixelContentName: "Short Reboot",
    /* THE COURSE, NOT THE BOT (2026-08-29). Both names appear because they are
       two different questions: the learner opens `/learn/short`, and a buyer
       coming back from the payment lands on `/programs/reboot`, which is where
       this offer is sold. */
    fulfilment: { kind: "course", courseSlug: "short", programSlug: "reboot" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  irem: {
    heading: {
      uk: "ІВЕМ-гімнастика — онлайн-система",
      en: "IREM gymnastics — online system",
    },
    description: {
      uk: 'Оплата онлайн-системи "ІВЕМ-гімнастика" від CenterWay. Після успішної оплати система відкриється у вашому кабінеті на платформі - там уроки, розбори вправ і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
      en: "Online system payment by CenterWay. After successful payment the system opens in your account on the platform, with its lessons, exercise breakdowns and next steps. Support: if you have questions, message us and we will help.",
    },
    amount: 3950,
    listAmount: 3950,
    currency: "UAH",
    pixelContentName: "IREM",
    /* THE COURSE, NOT THE BOT (2026-08-29). The row is `irem-gymnastics` and
       the offer is sold at `/programs/irem` — the only product where the two
       names differ in both directions. `irem` also had to be added to that
       course's entitlement codes in the same pass, or every past buyer would
       have been handed a platform link to a course that did not accept their
       order. */
    fulfilment: { kind: "course", courseSlug: "irem-gymnastics", programSlug: "irem" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  way21: {
    heading: {
      uk: "Шлях 21 — інтегративна детокс-програма",
      en: "Way 21 — integrative detox program",
    },
    description: {
      uk: 'Оплата детокс-програми "Шлях 21" від CenterWay. Після успішної оплати програма відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
      en: "Detox program payment by CenterWay. After successful payment the program opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help.",
    },
    amount: 4100,
    listAmount: 4100,
    currency: "UAH",
    pixelContentName: "Way21 Detox",
    fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  "way21-support": {
    heading: {
      uk: "Шлях 21 — індивідуальний супровід",
      en: "Way 21 — guided package",
    },
    description: {
      uk: 'Оплата пакета "Шлях 21 — індивідуальний супровід" від CenterWay: програма детоксу з 2 особистими консультаціями та персональним веденням. Після оплати програма відкриється у вашому кабінеті на платформі, а час консультацій узгодимо з вами особисто. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
      en: "Guided package payment by CenterWay: the detox program with 2 personal consultations and individual guidance. After payment the program opens in your account on the platform, and we arrange the consultation times with you personally. Support: if you have questions, message us and we will help.",
    },
    // No test price: the guided package sells through the landing's lead form,
    // so nothing charges this amount in the QA flow. It stands as the quote used
    // when the sale is invoiced after the conversation.
    amount: 9000,
    listAmount: 9000,
    currency: "UAH",
    pixelContentName: "Way21 Support",
    fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  "reset-day": {
    heading: {
      uk: "Розвантажувальний день — міні-курс",
      en: "Reset Day — mini course",
    },
    description: {
      uk: 'Оплата міні-курсу "Розвантажувальний день" від CenterWay. Після успішної оплати міні-курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо.',
      en: "Mini course payment by CenterWay. After successful payment the mini course opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help.",
    },
    amount: 795,
    listAmount: 795,
    currency: "UAH",
    pixelContentName: "Reset Day",
    fulfilment: { kind: "course", courseSlug: "reset-day", programSlug: "reset-day" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  herbs: {
    heading: {
      uk: "Фітозбір — індивідуальний підбір",
      en: "Herbal blend — individual selection",
    },
    description: {
      uk: "Оплата індивідуального підбору фітозбору від CenterWay. Після успішної оплати відкриється сторінка підтвердження та кнопка переходу до продукту в кабінеті — там же будуть подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо.",
      en: "Individual herbal blend payment by CenterWay. After successful payment, a confirmation page opens with a button to the product in the cabinet and next steps. Support: if you have questions, message us and we will help.",
    },
    // Unreachable: `productOffer` refuses the fallback when `listAmount` is
    // null, so nothing charges this. Zero rather than a placeholder figure, so
    // a future path that does read it cannot sell a blend for a hryvnia. The
    // real price is set in the admin and lives in `product_offers`.
    amount: 0,
    // Null, not a number: there is no agreed price to quote, and a surface that
    // must show one is required to say so rather than invent it.
    listAmount: null,
    currency: "UAH",
    pixelContentName: "Herbal Blend",
    fulfilment: { kind: "cabinet" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
} as const;

/**
 * The six products written in this file, and only those.
 *
 * WHAT IS LEFT OF THEM (2026-09-25). Prices, invoice prose, reporting labels
 * and every spelling a code was ever sold under live in `experience_offers` and
 * `offer_aliases`, and a code reaches its offer only through `describeOffer`.
 * The entries below are read by the surfaces that have not moved yet — the
 * support bot's course map, the agent corpus, the report key and the IREM
 * landing — and go when the last of them does.
 */
export type CatalogProductCode = keyof typeof PRODUCTS;

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

/** One of the six written in this file — the only codes `PRODUCTS` may be indexed by. */
export function isCatalogProduct(product: string | null | undefined): product is CatalogProductCode {
  return typeof product === "string" && Object.prototype.hasOwnProperty.call(PRODUCTS, product);
}

export type ProductFulfilment =
  /**
   * The platform serves it.
   *
   * TWO SLUGS, because they answer two questions and are not always the same
   * string. `courseSlug` is the row — it addresses `/learn/<courseSlug>`, where
   * the buyer reads the thing. `programSlug` is where the offer is SOLD, and it
   * is what a buyer returning from WayForPay is sent to. They agree for three
   * of the four course products, is
   * spelled out for `short` (/programs/reboot) and `irem-gymnastics`
   * (/programs/irem), whose public names are years older than their rows.
   */
  | { kind: "course"; courseSlug: string; programSlug?: string }
  /**
   * A Telegram bot delivers it. NOTHING DECLARES THIS ANY MORE (2026-08-29):
   * Short Reboot and IREM were the last two, and both moved onto the platform —
   * one place to read a course, one place a receipt can point at.
   *
   * Kept rather than deleted, and the distinction is worth being exact about:
   * fulfilment is read from THIS file, so no live purchase can produce this
   * shape today — the receipt email and the pay-status page branch on it and
   * that branch is unreachable. It stays because "delivered somewhere else
   * entirely" is a real third answer that a future product may need, and the
   * two surfaces already render it correctly.
   */
  | { kind: "bot"; url: string }
  | { kind: "cabinet" };

/**
 * Everything a payment needs to know about the thing being sold.
 *
 * WHY THIS TYPE EXISTS. Until 2026-08-22 the payment path read `PRODUCTS[code]`
 * directly, which quietly assumed every sellable thing is written in this file.
 * A course built in the builder is not: its price lives in `lms_course_offers`,
 * set by the owner, and it is read at request time. So the surfaces now take
 * the RESOLVED facts and no longer care which of the two places they came from
 * — see `loadPayableOffer` in src/lib/platform/offers.ts.
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

/**
 * The price a surface may QUOTE, in whole currency units — never the charged
 * one.
 *
 * Two numbers, on purpose. `amount` is what WayForPay is asked to take and is
 * read only by the server; `listAmount` is what a page is allowed to print.
 * Keeping them apart is what let a 1 ₴ QA price sit in `amount` for weeks
 * without any page advertising a hryvnia.
 *
 * `null` means "no agreed price": the caller must render the offer without a
 * figure rather than pick one.
 */
export function productListPrice(product: CatalogProductCode): number | null {
  return PRODUCTS[product].listAmount;
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

export function productHeading(product: CatalogProductCode, locale: Locale): string {
  const headings = PRODUCTS[product].heading;
  return headings[locale] ?? headings[DEFAULT_LOCALE];
}

export function productDescription(product: CatalogProductCode, locale: Locale): string {
  const descriptions = PRODUCTS[product].description;
  return descriptions[locale] ?? descriptions[DEFAULT_LOCALE];
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
