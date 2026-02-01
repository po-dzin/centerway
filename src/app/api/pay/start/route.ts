// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PRODUCTS,
  ProductCode,
  Locale,
  normalizeLocale,
  productHeading,
  resolveProduct,
} from "@/lib/products";
import { buildReturnUrl, sanitizeWfpProductName } from "@/lib/pay";

export const runtime = "nodejs";

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function requiredEnv() {
  const need = ["WFP_MERCHANT_ACCOUNT", "WFP_SECRET_KEY", "APP_BASE_URL", "WFP_MERCHANT_DOMAIN"] as const;
  const missing = need.filter((k) => !process.env[k]);
  return { need, missing };
}

function makeOrderRef(product: ProductCode) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(4).toString("hex");
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

function resolveLocale(req: NextRequest, url: URL): Locale {
  const override = normalizeLocale(
    url.searchParams.get("lang") ??
      url.searchParams.get("locale") ??
      url.searchParams.get("language")
  );
  if (override) return override;

  const country = countryFromHeaders(req.headers);
  if (country === "UA") return "ua";

  const byAcceptLanguage = localeFromAcceptLanguage(req.headers);
  if (byAcceptLanguage) return byAcceptLanguage;

  return "en";
}

export async function GET(req: NextRequest) {
  const { missing } = requiredEnv();
  if (missing.length) {
    return NextResponse.json({ ok: false, error: "missing_env", need: missing }, { status: 500 });
  }

  const url = new URL(req.url);

  const product = resolveProduct({
    product: url.searchParams.get("product") ?? undefined,
  });

  const format = url.searchParams.get("format"); // json | null

  const cfg = PRODUCTS[product];
  const locale = resolveLocale(req, url);
  const title = sanitizeWfpProductName(productHeading(product, locale));

  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT!;
  const secretKey = process.env.WFP_SECRET_KEY!;
  const appBaseUrl = process.env.APP_BASE_URL!;
  const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN!;

  // 1) создаём order в базе
  const order_ref = makeOrderRef(product);

  const sb = supabaseAdmin();
  const { error: orderErr } = await sb.from("orders").insert({
    order_ref,
    product_code: product,
    amount: cfg.amount,
    currency: cfg.currency,
    status: "created",
  });

  if (orderErr) {
    return NextResponse.json(
      { ok: false, error: "db_order_insert_failed", details: orderErr.message },
      { status: 500 }
    );
  }

  // 2) создаём invoice в WayForPay
  // returnUrl используем как fallback (даже если в кабинете есть approve/decline)
  const returnUrl = buildReturnUrl(appBaseUrl, product, order_ref);

  const wfpPayload: any = {
    apiVersion: 1,
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantDomainName,
    orderReference: order_ref,
    orderDate: Math.floor(Date.now() / 1000),
    amount: cfg.amount,
    currency: cfg.currency,
    productName: [title],
    productPrice: [cfg.amount],
    productCount: [1],
    serviceUrl: `${appBaseUrl}/api/wfp/webhook`,
    returnUrl,
  };  

  // signature по WayForPay: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName;productCount;productPrice
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

  const resp = await fetch("https://api.wayforpay.com/api", {
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
    // non-json
  }

  if (!payUrl) {
    return NextResponse.json(
      { ok: false, error: "wfp_no_url", raw: text, order_ref },
      { status: 502 }
    );
  }

  if (format === "json") {
    return NextResponse.json({ ok: true, order_ref, product, url: payUrl });
  }

  return NextResponse.redirect(payUrl, 302);
}
