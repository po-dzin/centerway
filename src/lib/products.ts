export type SearchParams = Record<string, string | string[] | undefined>;

export const PRODUCTS = {
  short: {
    titles: {
      ua:
        "Оплата онлайн-курсу \"Short Reboot\" від Centerway.\nПісля успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції.\nПідтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en: "Short Reboot",
    },
    amount: 359,
    currency: "UAH",
    approvedUrl: "https://reboot.centerway.net.ua/thanks",
    declinedUrl: "https://reboot.centerway.net.ua/pay-failed",
  },
  irem: {
    titles: {
      ua:
        "Оплата онлайн-системи \"IREM gymnastics\" від Centerway.\nПісля успішної оплати відкриється сторінка підтвердження та кнопка для входу в Telegram-бот - там буде ваш доступ і подальші інструкції.\nПідтримка: якщо виникли питання - напишіть нам, допоможемо швидко.",
      en: "IREM",
    },
    amount: 4000,
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

export function productTitle(product: ProductCode, locale: Locale): string {
  const titles = PRODUCTS[product].titles;
  return titles[locale] ?? titles[DEFAULT_LOCALE];
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
