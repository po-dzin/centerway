import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  Locale,
  PayableProductCode,
  PayableOffer,
  normalizeLocale,
  offerDescription,
  offerHeading,
} from "@/lib/products";
import { buildReturnUrl, buildWfpProductName } from "@/lib/pay";
import type { CapiEventPayload } from "@/lib/tracking/capi";
import { dispatchCapiEventInline } from "@/lib/tracking/capiDispatch";
import { STAFF_CHECKOUT_EVENT } from "@/lib/tracking/staffOrders";

export type PaymentStartSuccess = {
  ok: true;
  order_ref: string;
  product: PayableProductCode;
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
  /**
   * WHAT IS BEING SOLD, ALREADY RESOLVED.
   *
   * It used to be a product CODE, and this function looked the price up in
   * `PRODUCTS`. That worked only while every sellable thing was written in that
   * file. A course out of the builder is priced in `lms_course_offers`, so the
   * caller resolves the offer (`loadPayableOffer`) and refuses the payment when
   * there is none — which is a decision a route can make and this function
   * cannot.
   */
  offer: PayableOffer;
  locale: Locale;
  source: "pay_start" | "checkout_start";
  offer_id?: string | null;
  amountOverride?: number | null;
  host?: string | null;
  payload?: Record<string, unknown>;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  campaign?: string | null;
  client_ip?: string | null;   // IP пользователя в момент клика на оплату
  client_ua?: string | null;   // User-Agent браузера
  page_url?: string | null;    // URL лендинга (event_source_url для CAPI)
  event_id?: string | null;    // event_id для dedupe Pixel + CAPI (InitiateCheckout)
  staff?: boolean;             // internal/QA traffic — skip Meta CAPI (InitiateCheckout)
};

type PaymentDb = ReturnType<typeof supabaseAdmin>;

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

/**
 * `course:my-course` → `course-my-course`.
 *
 * The order reference is echoed by WayForPay, read back out of URLs and used as
 * a key in three tables. A colon in it is a character that has to survive all
 * of that intact, for no gain — the product is carried separately in
 * `orders.product_code` and in the return URL. Only the prefix is touched.
 */
/**
 * `course:<slug>` carries a colon, and the order_ref built from it travels through
 * `orders`, `payments`, `access_tokens`, `events` and the return URL. Flattening the
 * colon here keeps that key to one alphabet everywhere it is stored or parsed.
 */
export function orderRefToken(product: PayableProductCode): string {
  return product.replace(/[^a-z0-9-]+/gi, "-");
}

export function makeOrderRef(product: PayableProductCode, nowMs: () => number, randomHex: (bytes: number) => string) {
  const d = new Date(nowMs());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = randomHex(4);
  return `${orderRefToken(product)}_${y}${m}${day}_${rand}`;
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
  if (country === "UA") return "uk";

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

  const cfg = input.offer;
  const product = cfg.code;
  const amount =
    typeof input.amountOverride === "number" && Number.isFinite(input.amountOverride) && input.amountOverride > 0
      ? input.amountOverride
      : cfg.amount;
  const title = buildWfpProductName(
    offerHeading(cfg, input.locale),
    offerDescription(cfg, input.locale)
  );

  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT!;
  const secretKey = process.env.WFP_SECRET_KEY!;
  const appBaseUrl = process.env.APP_BASE_URL!;
  const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN!;

  const order_ref = makeOrderRef(product, deps.nowMs, deps.randomHex);
  const sb = deps.db;

  // The WayForPay CREATE_INVOICE round-trip is the slowest leg of this request and
  // depends only on locally-computed values (order_ref, amount, signature). Kick it
  // off first and let the order/analytics writes run concurrently underneath it
  // instead of stacking them sequentially ahead of the external call.
  const returnUrl = buildReturnUrl(appBaseUrl, product, order_ref);

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
    amount,
    currency: cfg.currency,
    productName: [title],
    productPrice: [amount],
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

  const wfpResponsePromise = deps.fetchFn("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wfpPayload),
  });

  const orderInsertPromise = sb.from("orders").insert({
    order_ref,
    product_code: product,
    amount,
    currency: cfg.currency,
    status: "created",
    fbp: input.fbp,
    fbclid: input.fbclid,
    campaign: input.campaign,
    client_ip: input.client_ip,
    client_ua: input.client_ua,
    page_url: input.page_url,
  });

  const clientEventId =
    typeof input.event_id === "string" && input.event_id.trim()
      ? input.event_id.trim()
      : null;
  const capiEventId = clientEventId ?? `checkout_${order_ref}`;

  // Ensure exactly one server-side InitiateCheckout CAPI job per order. This is pure
  // analytics, so it runs alongside the WFP call and never blocks the redirect.
  // Staff / QA traffic is excluded so it never reaches Meta.
  const capiJobPromise = input.staff ? Promise.resolve() : (async () => {
    try {
      const [existingByEventIdRes, existingByOrderRefRes] = await Promise.all([
        sb
          .from("jobs")
          .select("id")
          .eq("type", "meta:capi")
          .contains("payload", { event_name: "InitiateCheckout", event_id: capiEventId })
          .limit(1)
          .maybeSingle(),
        sb
          .from("jobs")
          .select("id")
          .eq("type", "meta:capi")
          .contains("payload", { event_name: "InitiateCheckout", order_ref: order_ref })
          .limit(1)
          .maybeSingle(),
      ]);

      const hasExistingInitiateCheckoutJob =
        Boolean(existingByEventIdRes.data?.id) || Boolean(existingByOrderRefRes.data?.id);

      if (hasExistingInitiateCheckoutJob) {
        return;
      }

      const capiPayload: CapiEventPayload = {
        event_name: "InitiateCheckout",
        event_id: capiEventId,
        event_time: Math.floor(deps.nowMs() / 1000),
        value: amount,
        currency: cfg.currency,
        order_ref,
        fbp: input.fbp ?? null,
        fbc: input.fbc ?? null,
        fbclid: input.fbclid ?? null,
        ip_address: input.client_ip ?? null,
        user_agent: input.client_ua ?? null,
        event_source_url: input.page_url ?? null,
        action_source: "website",
        // The agreed reporting label, not the invoice line. This used to send
        // the localized heading, which made the same product arrive in Meta
        // under a different name per language and per surface.
        content_name: cfg.pixelContentName,
        content_type: "product",
        content_ids: [product],
      };
      const { data: job } = await sb
        .from("jobs")
        .insert({
          type: "meta:capi",
          payload: capiPayload,
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      // Fire InitiateCheckout to Meta immediately (alongside the browser Pixel event);
      // the job row stays the durable fallback for the daily cron.
      if (job?.id) {
        dispatchCapiEventInline(sb, job.id, capiPayload);
      }
    } catch (capiErr) {
      console.warn("capi_initiate_checkout_failed", capiErr, { order_ref });
    }
  })();

  /* The staff flag lives in the browser, and the WayForPay webhook has no browser.
     Without a mark on the order itself, a 1 ₴ QA payment came back as a real
     Purchase to Meta — the exact conversion this flag exists to suppress. The
     mark is written here and read by the webhook; it is awaited rather than
     fire-and-forget, because the suppression downstream depends on it existing. */
  const staffMarkerPromise = input.staff
    ? (async () => {
        try {
          const { error: staffMarkErr } = await sb.from("events").insert({
            type: STAFF_CHECKOUT_EVENT,
            order_ref,
            payload: { product, source: input.source, host: input.host ?? null },
          });
          if (staffMarkErr) {
            console.warn("staff_checkout_mark_failed", staffMarkErr.message, { order_ref });
          }
        } catch (staffMarkErr) {
          console.warn("staff_checkout_mark_failed", staffMarkErr, { order_ref });
        }
      })()
    : Promise.resolve();

  if (!input.staff) void (async () => {
    try {
      const { error: checkoutStartedErr } = await sb.from("events").insert({
        type: "checkout_started",
        order_ref,
        payload: {
          source: input.source,
          host: input.host ?? null,
          product,
          offer_id: input.offer_id ?? null,
          event_id: clientEventId,
          fbp: input.fbp ?? null,
          fbc: input.fbc ?? null,
          fbclid: input.fbclid ?? null,
          campaign: input.campaign ?? null,
          client_ip: input.client_ip ?? null,
          client_ua: input.client_ua ?? null,
          page_url: input.page_url ?? null,
          ...(input.payload ?? {}),
        },
      });
      if (checkoutStartedErr) {
        console.warn("checkout_started_insert_failed", checkoutStartedErr.message, { order_ref });
      }
    } catch (checkoutStartedErr) {
      console.warn("checkout_started_insert_failed", checkoutStartedErr, { order_ref });
    }
  })();

  const [{ error: orderErr }, resp] = await Promise.all([orderInsertPromise, wfpResponsePromise]);
  // Keep the CAPI job overlapped with the WFP call without dropping it on the floor.
  await capiJobPromise;
  await staffMarkerPromise;

  if (orderErr) {
    return {
      ok: false,
      status: 500,
      error: "db_order_insert_failed",
      details: orderErr.message,
    };
  }

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
    product,
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
