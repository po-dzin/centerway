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
 *   bot     — a Telegram bot delivers it, with its own ?start= token
 *   cabinet — no course of its own; the purchase exists in /profile
 *
 * `pixelContentName` is kept verbatim from the strings the landings sent, not
 * rewritten to something tidier: it is a REPORTING LABEL in Meta, and renaming
 * it splits one product's history into two lines.
 */
export const PRODUCTS = {
  short: {
    heading: {
      ua: "Short Reboot — онлайн-курс",
      en: "Short Reboot — online course",
    },
    description: {
      ua:
        "Оплата онлайн-курсу \"Short Reboot\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Online course payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: 795,
    listAmount: 795,
    currency: "UAH",
    pixelContentName: "Short Reboot",
    fulfilment: { kind: "bot", url: "https://telegram.me/ShortRebotBot?start=6a1b2e01f73e6df7570fff07" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  irem: {
    heading: {
      ua: "IREM gymnastics — онлайн-система",
      en: "IREM gymnastics — online system",
    },
    description: {
      ua:
        "Оплата онлайн-системи \"IREM gymnastics\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Online system payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: 3950,
    listAmount: 3950,
    currency: "UAH",
    pixelContentName: "IREM",
    fulfilment: { kind: "bot", url: "https://telegram.me/IREM_gymnastic_Bot?start=ZGw6MjA1MTY4" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  way21: {
    heading: {
      ua: "Шлях 21 — інтегративна детокс-програма",
      en: "Way 21 — integrative detox program",
    },
    description: {
      ua:
        "Оплата детокс-програми \"Шлях 21\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Detox program payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — charged
    listAmount: 4100,
    currency: "UAH",
    pixelContentName: "Way21 Detox",
    fulfilment: { kind: "course", courseSlug: "way21" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  "way21-support": {
    heading: {
      ua: "Шлях 21 — індивідуальний супровід",
      en: "Way 21 — guided package",
    },
    description: {
      ua:
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
    fulfilment: { kind: "course", courseSlug: "way21" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  "reset-day": {
    heading: {
      ua: "Розвантажувальний день — міні-курс",
      en: "Reset Day — mini course",
    },
    description: {
      ua:
        "Оплата міні-курсу \"Розвантажувальний день\" від Centerway. Після успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції. Підтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en:
        "Mini course payment by Centerway. After successful payment, a confirmation page will open with a Telegram bot entry button for your access and next steps. Support: if you have questions, message us and we will help quickly.",
    },
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — charged
    listAmount: 795,
    currency: "UAH",
    pixelContentName: "Reset Day",
    fulfilment: { kind: "course", courseSlug: "reset-day" },
    approvedUrl: PLATFORM_THANKS_URL,
    declinedUrl: PLATFORM_FAILED_URL,
  },
  herbs: {
    heading: {
      ua: "Фітозбір — індивідуальний підбір",
      en: "Herbal blend — individual selection",
    },
    description: {
      ua:
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
export const LEAD_PRODUCT_CODES = ["consult", "ideal-body", "platform", "irem-individual"] as const;

export type PayableProductCode = keyof typeof PRODUCTS;
export type LeadProductCode = (typeof LEAD_PRODUCT_CODES)[number];
export type ProductCode = PayableProductCode | LeadProductCode;
export type Locale = "ua" | "en";

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
    if (s === "short" || s === "reboot") return "short";
    if (s === "irem-individual" || s === "irem_individual" || s === "irem-support") return "irem-individual";
    if (s === "irem") return "irem";
    if (s === "way21-support" || s === "way21_support") return "way21-support";
    if (s === "way21" || s === "shlyah21" || s === "detox21") return "way21";
    if (s === "reset-day" || s === "reset_day" || s === "reset" || s === "rozvantazhennya") return "reset-day";
    if (s === "consult" || s === "consultation") return "consult";
    if (s === "ideal-body" || s === "ideal_body" || s === "idealne-tilo") return "ideal-body";
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

/**
 * Всегда возвращает валидный продукт (дефолт short)
 */
export function resolveProduct(input: unknown): ProductCode {
  return normalizeProduct(input) ?? "short";
}

export function isPayableProduct(product: ProductCode | string | null | undefined): product is PayableProductCode {
  return (
    product === "short" ||
    product === "irem" ||
    product === "way21" ||
    product === "way21-support" ||
    product === "reset-day" ||
    product === "herbs"
  );
}

export function normalizePayableProduct(input: unknown): PayableProductCode | null {
  const product = normalizeProduct(input);
  return isPayableProduct(product) ? product : null;
}

export type ProductFulfilment =
  | { kind: "course"; courseSlug: string }
  | { kind: "bot"; url: string }
  | { kind: "cabinet" };

export function productFulfilment(product: PayableProductCode): ProductFulfilment {
  return PRODUCTS[product].fulfilment;
}

export function resolvePayableProduct(input: unknown): PayableProductCode {
  return normalizePayableProduct(input) ?? "short";
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
export function productListPrice(product: PayableProductCode): number | null {
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
  if (s === "ua" || s === "uk" || s === "uk-ua" || s === "ua-ua") return "ua";
  if (s === "en" || s.startsWith("en-")) return "en";
  return null;
}

export function productHeading(product: PayableProductCode, locale: Locale): string {
  const headings = PRODUCTS[product].heading;
  return headings[locale] ?? headings[DEFAULT_LOCALE];
}

export function productDescription(product: PayableProductCode, locale: Locale): string {
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
