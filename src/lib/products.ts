export type SearchParams = Record<string, string | string[] | undefined>;

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
    currency: "UAH",
    approvedUrl: "https://reboot.centerway.net.ua/thanks",
    declinedUrl: "https://reboot.centerway.net.ua/pay-failed",
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
    currency: "UAH",
    approvedUrl: "https://irem.centerway.net.ua/thanks",
    declinedUrl: "https://irem.centerway.net.ua/pay-failed",
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
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — real: 4100
    currency: "UAH",
    // TODO(placeholder): swap to the real way21 funnel subdomain + bot before launch.
    approvedUrl: "https://way21.centerway.net.ua/thanks",
    declinedUrl: "https://way21.centerway.net.ua/pay-failed",
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
    currency: "UAH",
    // TODO(placeholder): swap to the real way21 funnel subdomain + bot before launch.
    approvedUrl: "https://way21.centerway.net.ua/thanks",
    declinedUrl: "https://way21.centerway.net.ua/pay-failed",
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
    amount: TEST_PRICE_UAH, // CW_TEST_PRICE_1UAH — real: 795
    currency: "UAH",
    // TODO(placeholder): swap to the real reset-day funnel subdomain + bot before launch.
    approvedUrl: "https://resetday.centerway.net.ua/thanks",
    declinedUrl: "https://resetday.centerway.net.ua/pay-failed",
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
    currency: "UAH",
    approvedUrl: "https://herbs.centerway.net.ua/thanks",
    declinedUrl: "https://herbs.centerway.net.ua/pay-failed",
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

export function resolvePayableProduct(input: unknown): PayableProductCode {
  return normalizePayableProduct(input) ?? "short";
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
