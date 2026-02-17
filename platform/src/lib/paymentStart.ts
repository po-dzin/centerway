import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  Locale,
  ProductCode,
  PRODUCTS,
  normalizeLocale,
  productDescription,
  productHeading,
} from "@/lib/products";
import { buildReturnUrl, buildWfpProductName } from "@/lib/pay";

export type PaymentStartSuccess = {
  ok: true;
  order_ref: string;
  product: ProductCode;
  payUrl: string;
};

export type PaymentStartError = {
  ok: false;
  status: number;
  error: string;
  details?: string;
  order_ref?: string;
  need?: readonly string[];
  raw?: string;
};

export type PaymentStartResult = PaymentStartSuccess | PaymentStartError;

export type PaymentStartInput = {
  product: ProductCode;
  locale: Locale;
  source: "pay_start" | "checkout_start";
  host?: string | null;
  payload?: Record<string, unknown>;
};

type PaymentDb = {
  from: (table: string) => {
    insert: (value: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>;
  };
};

type PaymentDeps = {
  db: PaymentDb;
  fetchFn: typeof fetch;
  nowMs: () => number;
  randomHex: (bytes: number) => string;
};

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

export function requiredPaymentEnv() {
  const need = ["WFP_MERCHANT_ACCOUNT", "WFP_SECRET_KEY", "APP_BASE_URL", "WFP_MERCHANT_DOMAIN"] as const;
  const missing = need.filter((k) => !process.env[k]);
  return { need, missing };
}

function makeOrderRef(product: ProductCode, nowMs: () => number, randomHex: (bytes: number) => string) {
  const d = new Date(nowMs());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = randomHex(4);
  return `${product}_${y}${m}${day}_${rand}`;
}

function countryFromHeaders(headers: Headers): string | null {
  const candidates = [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country",
    "x-geo-country",
    "fastly-client-country",
    "x-appengine-country",
  ];
  for (const name of candidates) {
    const v = headers.get(name);
    if (v && v.trim()) return v.trim().toUpperCase();
  }
  return null;
}

function localeFromAcceptLanguage(headers: Headers): Locale | null {
  const raw = headers.get("accept-language");
  if (!raw) return null;
  for (const part of raw.split(",")) {
    const tag = part.trim().split(";")[0];
    const loc = normalizeLocale(tag);
    if (loc) return loc;
  }
  return null;
}

export function resolveLocaleFromRequest(headers: Headers, search: URLSearchParams): Locale {
  const override = normalizeLocale(
    search.get("lang") ??
      search.get("locale") ??
      search.get("language")
  );
  if (override) return override;

  const country = countryFromHeaders(headers);
  if (country === "UA") return "ua";

  const byAcceptLanguage = localeFromAcceptLanguage(headers);
  if (byAcceptLanguage) return byAcceptLanguage;

  return "en";
}

export async function createPaymentInvoiceWithDeps(
  input: PaymentStartInput,
  deps: PaymentDeps
): Promise<PaymentStartResult> {
  const { missing, need } = requiredPaymentEnv();
  if (missing.length) {
    return {
      ok: false,
      status: 500,
      error: "missing_env",
      need,
      details: missing.join(","),
    };
  }

  const cfg = PRODUCTS[input.product];
  const title = buildWfpProductName(
    productHeading(input.product, input.locale),
    productDescription(input.product, input.locale)
  );

  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT!;
  const secretKey = process.env.WFP_SECRET_KEY!;
  const appBaseUrl = process.env.APP_BASE_URL!;
  const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN!;

  const order_ref = makeOrderRef(input.product, deps.nowMs, deps.randomHex);
  const sb = deps.db;

  const { error: orderErr } = await sb.from("orders").insert({
    order_ref,
    product_code: input.product,
    amount: cfg.amount,
    currency: cfg.currency,
    status: "created",
  });

  if (orderErr) {
    return {
      ok: false,
      status: 500,
      error: "db_order_insert_failed",
      details: orderErr.message,
    };
  }

  // Non-blocking analytics event.
  await sb.from("events").insert({
    event_type: "checkout_started",
    order_ref,
    payload: {
      source: input.source,
      host: input.host ?? null,
      product: input.product,
      ...(input.payload ?? {}),
    },
  });

  const returnUrl = buildReturnUrl(appBaseUrl, input.product, order_ref);

  const wfpPayload: {
    apiVersion: number;
    transactionType: string;
    merchantAccount: string;
    merchantDomainName: string;
    orderReference: string;
    orderDate: number;
    amount: number;
    currency: string;
    productName: string[];
    productPrice: number[];
    productCount: number[];
    serviceUrl: string;
    returnUrl: string;
    merchantSignature?: string;
  } = {
    apiVersion: 1,
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantDomainName,
    orderReference: order_ref,
    orderDate: Math.floor(deps.nowMs() / 1000),
    amount: cfg.amount,
    currency: cfg.currency,
    productName: [title],
    productPrice: [cfg.amount],
    productCount: [1],
    serviceUrl: `${appBaseUrl}/api/wfp/webhook`,
    returnUrl,
  };

  const signStr = [
    merchantAccount,
    merchantDomainName,
    wfpPayload.orderReference,
    wfpPayload.orderDate,
    wfpPayload.amount,
    wfpPayload.currency,
    ...wfpPayload.productName,
    ...wfpPayload.productCount.map(String),
    ...wfpPayload.productPrice.map(String),
  ].join(";");

  wfpPayload.merchantSignature = hmacMd5Hex(secretKey, signStr);

  const resp = await deps.fetchFn("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wfpPayload),
  });

  const text = await resp.text();
  let payUrl: string | null = null;
  try {
    const j = JSON.parse(text);
    payUrl = j.invoiceUrl ?? j.url ?? null;
  } catch {
    // non-json response
  }

  if (!payUrl) {
    return {
      ok: false,
      status: 502,
      error: "wfp_no_url",
      raw: text,
      order_ref,
    };
  }

  return {
    ok: true,
    order_ref,
    product: input.product,
    payUrl,
  };
}

export async function createPaymentInvoice(input: PaymentStartInput): Promise<PaymentStartResult> {
  return createPaymentInvoiceWithDeps(input, {
    db: supabaseAdmin(),
    fetchFn: fetch,
    nowMs: () => Date.now(),
    randomHex: (bytes: number) => crypto.randomBytes(bytes).toString("hex"),
  });
}
