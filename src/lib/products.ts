export type SearchParams = Record<string, string | string[] | undefined>;

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
    amount: 359,
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
    amount: 4100,
    currency: "UAH",
    approvedUrl: "https://irem.centerway.net.ua/thanks",
    declinedUrl: "https://irem.centerway.net.ua/pay-failed",
  },
} as const;

export type ProductCode = keyof typeof PRODUCTS;
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
    if (s === "short" || s === "irem") return s;
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

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === "ua" || s === "uk" || s === "uk-ua" || s === "ua-ua") return "ua";
  if (s === "en" || s.startsWith("en-")) return "en";
  return null;
}

export function productHeading(product: ProductCode, locale: Locale): string {
  const headings = PRODUCTS[product].heading;
  return headings[locale] ?? headings[DEFAULT_LOCALE];
}

export function productDescription(product: ProductCode, locale: Locale): string {
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
