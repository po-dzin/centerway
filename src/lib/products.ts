import { courseOfferCode, parseCourseOfferCode } from "@/lms-core/offerCode";

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
 * TEST PRICE — 1 UAH. Short-lived: put in on 2026-08-21 for a couple of days of
 * QA, so walking the purchase chain end to end does not move real money through
 * WayForPay.
 *
 * THIS FILE IS THE ONLY PLACE IT LIVES. The landings still show their real
 * prices, on purpose — the charged sum is always read from PRODUCTS[...].amount,
 * never from the page. `data-cw-price-value` and `PRICE_VALUE` in the landings'
 * js/common.js are pixel values only and cannot mischarge; `amountOverride` in
 * /api/pay/start is reachable only through irem's personal offers.
 *
 * The cost of that split, stated plainly: while this is in, a buyer is quoted
 * 4100 and charged 1. That is fine for a closed QA window on noindex landings
 * and NOT fine once traffic arrives.
 *
 * TO REVERT: grep for CW_TEST_PRICE_1UAH — the real amount sits next to each
 * line. Nothing outside this file needs touching.
 */
const TEST_PRICE_UAH = 1;

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
      uk:
        "Оплата онлайн-курсу \"Short Reboot\" від Centerway. Після успішної оплати курс відкриється у вашому кабінеті на платформі - там уроки, матеріали і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Online course payment by Centerway. After successful payment the course opens in your account on the platform, with its lessons, materials and next steps. Support: if you have questions, message us and we will help quickly.",
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
      uk: "IREM gymnastics — онлайн-система",
      en: "IREM gymnastics — online system",
    },
    description: {
      uk:
        "Оплата онлайн-системи \"IREM gymnastics\" від Centerway. Після успішної оплати система відкриється у вашому кабінеті на платформі - там уроки, розбори вправ і подальші кроки. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Online system payment by Centerway. After successful payment the system opens in your account on the platform, with its lessons, exercise breakdowns and next steps. Support: if you have questions, message us and we will help quickly.",
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
      uk:
        "Оплата детокс-програми \"Шлях 21\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Detox program payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — charged
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
      uk:
        "Оплата пакета \"Шлях 21 — індивідуальний супровід\" від Centerway: програма детоксу з 2 особистими консультаціями та персональним веденням. Після оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Guided package payment by Centerway: the detox program with 2 personal consultations and individual guidance. After payment, a confirmation page opens with a Telegram bot entry button. Support: if you have questions, message us and we will help quickly.",
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
      uk:
        "Оплата міні-курсу \"Розвантажувальний день\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Mini course payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — charged
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
      uk:
        "Оплата індивідуального підбору фітозбору від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка переходу до продукту в кабінеті — там же будуть подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Individual herbal blend payment by Centerway. After successful payment, a confirmation page opens with a button to the product in the cabinet and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    // CW_TEST_PRICE_1UAH. Unlike the others this has no real price to go back
    // to — herbs was never sold self-serve before. Agree one before launch,
    // and put it in the landing CTA label at the same time.
    amount: TEST_PRICE_UAH,
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

// Codes that only ever produce a lead, never an order. "herbs" left this list
// when it got its own checkout; consult stayed, because the consultation is
// agreed in conversation and its landing posts to /api/leads.
export const LEAD_PRODUCT_CODES = ["consult", "natural-body", "platform", "irem-individual"] as const;

/**
 * The six products written in this file, and only those.
 *
 * `PRODUCTS[code]` is safe for exactly this union and nothing wider — which is
 * the whole reason it has its own name now.
 */
export type CatalogProductCode = keyof typeof PRODUCTS;

/**
 * A course out of the builder, sold under its own code.
 *
 * Built by `courseOfferCode` and parsed by `parseCourseOfferCode`, both in
 * lms-core so the checkout and the entitlement cannot build it differently.
 * The two namespaces cannot collide: a `PRODUCTS` key can never contain a
 * colon.
 */
export type CourseProductCode = `course:${string}`;

/**
 * Anything that can be charged for.
 *
 * WIDENED 2026-08-22, and the widening is the point. While this was
 * `keyof typeof PRODUCTS`, every payment surface could write `PRODUCTS[code]`
 * and be right; a `course:<slug>` code reaching that indexing would have read
 * `undefined` — or, through `resolvePayableProduct`'s old fallback, charged the
 * buyer for Short Reboot. Prices for these codes live in the database, so the
 * commercial facts are now looked up (`loadPayableOffer`) rather than indexed.
 */
export type PayableProductCode = CatalogProductCode | CourseProductCode;
export type LeadProductCode = (typeof LEAD_PRODUCT_CODES)[number];
export type ProductCode = PayableProductCode | LeadProductCode;
export type Locale = "uk" | "en";

const DEFAULT_LOCALE: Locale = "en";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Нормализуем продукт из любого входа:
 * - "short" / "irem"
 * - { product: "irem" } / { product_code: "short" }
 * - Promise<searchParams>
 */
export function normalizeProduct(input: unknown): ProductCode | null {
  if (!input) return null;

  // строка
  if (typeof input === "string") {
    const s = input.trim().toLowerCase();
    // A course out of the builder. Checked FIRST and rebuilt from the parsed
    // slug rather than passed through, so nothing but the exact shape survives.
    const courseSlug = parseCourseOfferCode(s);
    if (courseSlug) return courseOfferCode(courseSlug) as CourseProductCode;
    if (s === "short" || s === "reboot") return "short";
    if (s === "irem-individual" || s === "irem_individual" || s === "irem-support") return "irem-individual";
    if (s === "irem") return "irem";
    if (s === "way21-support" || s === "way21_support") return "way21-support";
    if (s === "way21" || s === "shlyah21" || s === "detox21") return "way21";
    if (s === "reset-day" || s === "reset_day" || s === "reset" || s === "rozvantazhennya") return "reset-day";
    if (s === "consult" || s === "consultation") return "consult";
    // `ideal-body` is the name this product was sold under until 2026-08-29;
    // it stays on the left of the arrow for exactly the reason the others do.
    if (s === "natural-body" || s === "ideal-body" || s === "ideal_body" || s === "idealne-tilo")
      return "natural-body";
    if (s === "herbs") return "herbs";
    if (s === "platform" || s === "centerway") return "platform";
    return null;
  }

  // объект searchParams
  if (typeof input === "object") {
    const sp = input as SearchParams;
    const raw =
      first(sp.product) ??
      first(sp.product_code) ??
      first(sp.p);

    if (typeof raw === "string") return normalizeProduct(raw);
    return null;
  }

  return null;
}

/** One of the six written in this file — the only codes `PRODUCTS` may be indexed by. */
export function isCatalogProduct(
  product: ProductCode | string | null | undefined
): product is CatalogProductCode {
  return typeof product === "string" && Object.prototype.hasOwnProperty.call(PRODUCTS, product);
}

export function isPayableProduct(product: ProductCode | string | null | undefined): product is PayableProductCode {
  return isCatalogProduct(product) || parseCourseOfferCode(product) !== null;
}

export function normalizePayableProduct(input: unknown): PayableProductCode | null {
  const product = normalizeProduct(input);
  return isPayableProduct(product) ? product : null;
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

export function productFulfilment(product: CatalogProductCode): ProductFulfilment {
  return PRODUCTS[product].fulfilment;
}

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
 * `listAmount` is what a page may PRINT and `amount` is what is charged; they
 * diverge while the 1 ₴ QA window is open (CW_TEST_PRICE_1UAH). `null` means
 * no agreed price, and a surface that must show one has to say so.
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

/** One of the six, as an offer. Pure — no database, no await. */
export function catalogOffer(code: CatalogProductCode): PayableOffer {
  const entry = PRODUCTS[code];
  return {
    code,
    heading: { uk: entry.heading.uk, en: entry.heading.en },
    description: { uk: entry.description.uk, en: entry.description.en },
    amount: entry.amount,
    listAmount: entry.listAmount,
    currency: entry.currency,
    pixelContentName: entry.pixelContentName,
    fulfilment: entry.fulfilment,
    approvedUrl: entry.approvedUrl,
    declinedUrl: entry.declinedUrl,
  };
}

export function offerHeading(offer: PayableOffer, locale: Locale): string {
  return offer.heading[locale] ?? offer.heading[DEFAULT_LOCALE];
}

export function offerDescription(offer: PayableOffer, locale: Locale): string {
  return offer.description[locale] ?? offer.description[DEFAULT_LOCALE];
}

/**
 * Where a buyer is sent back to after paying for `code`.
 *
 * The six answer from their own entry; anything else answers with the platform
 * pair, which is what all six point at anyway. A code with no entry must still
 * return somewhere real — a return URL is decided before the payment, and a
 * missing one strands the buyer on WayForPay.
 */
export function productReturnUrls(code: string): { approvedUrl: string; declinedUrl: string } {
  if (isCatalogProduct(code)) {
    return { approvedUrl: PRODUCTS[code].approvedUrl, declinedUrl: PRODUCTS[code].declinedUrl };
  }
  return { approvedUrl: PLATFORM_THANKS_URL, declinedUrl: PLATFORM_FAILED_URL };
}

/**
 * The offer page for what `code` sells, when there is one.
 *
 * WHAT IT IS FOR. A buyer who pays for a course used to land on a confirmation
 * page and then press a second button to reach the thing they bought. That page
 * exists for a real reason — a bot purchase has nowhere else to go, and a
 * physical order has only the cabinet — but for a course it is a step between
 * the payment and the course whose entire content is "you paid". The offer page
 * they came from already knows how to show a course as owned: unlocked lessons,
 * their standing, a button into the last one. Sending them back to it is the
 * confirmation.
 *
 * `null` for anything without an offer page — bot deliveries and the herb
 * order, which keep `/pay/thanks`.
 *
 * NOT ASYNC, and it must not become so: it is called while deciding the return
 * URL, and a database read there is a way for a payment to end nowhere. A
 * builder course answers from its code alone (`course:<slug>` → `/programs/
 * <slug>`), and it cannot be sold at all unless that page is already public —
 * `loadPayableOffer` refuses a course that is not.
 */
export function productProgramPath(code: string): string | null {
  const courseCode = parseCourseOfferCode(code);
  if (courseCode) return `/programs/${courseCode}`;

  if (isCatalogProduct(code)) {
    const fulfilment = PRODUCTS[code].fulfilment;
    /* THE PROGRAM SLUG, falling back to the course slug where the two agree.
       They stopped agreeing on 2026-08-29, when Short Reboot and IREM moved off
       Telegram delivery: `short` is sold at /programs/reboot and
       `irem-gymnastics` at /programs/irem, and returning a buyer to the row
       name would have ended a paid checkout on a 404. */
    if (fulfilment.kind === "course") return `/programs/${fulfilment.programSlug}`;
  }

  return null;
}

/**
 * The price a surface may QUOTE, in whole currency units — never the charged
 * one.
 *
 * Two numbers, on purpose. `amount` is what WayForPay is asked to take and is
 * read only by the server; `listAmount` is what a page is allowed to print.
 * They diverge exactly while the 1 ₴ QA window is open (CW_TEST_PRICE_1UAH),
 * and a page that read `amount` would quietly advertise a hryvnia.
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
