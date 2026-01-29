// src/app/api/pay/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS, normalizeProduct, type ProductCode } from "@/lib/products";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function makeOrderRef(product: ProductCode) {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const rand = crypto.randomBytes(4).toString("hex");
  return `${product}_${y}${m}${day}_${rand}`;
}

/**
 * WayForPay signature.
 * В твоём проекте уже используется HMAC-MD5 — оставляем так, чтобы не ломать.
 */
function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

async function ensureOrder(product: ProductCode, order_ref?: string) {
  const sb = supabaseAdmin();
  const cfg = PRODUCTS[product];

  if (order_ref) return { order_ref };

  const newRef = makeOrderRef(product);
  const customer_id = crypto.randomUUID();

  const { error } = await sb.from("orders").insert({
    order_ref: newRef,
    product_code: product,
    amount: cfg.amount,
    currency: cfg.currency,
    status: "created",
    customer_id,
  });

  if (error) throw new Error(`db_order_insert_failed: ${error.message}`);

  await sb.from("events").insert({
    type: "pay_start_order_created",
    order_ref: newRef,
    customer_id,
    payload: { product_code: product },
  });

  return { order_ref: newRef };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const qpProduct = url.searchParams.get("product");
  const qpOrderRef = url.searchParams.get("order_ref");
  const format = url.searchParams.get("format"); // "json" => вернуть json, иначе редирект

  // 1) вычисляем продукт (без null)
  const productFromRef = qpOrderRef ? normalizeProduct(qpOrderRef.split("_")[0]) : null;
  const product: ProductCode = productFromRef ?? normalizeProduct(qpProduct) ?? "short";
  const cfg = PRODUCTS[product];

  // 2) env
  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT;
  const secretKey = process.env.WFP_SECRET_KEY;
  const appBaseUrl = process.env.APP_BASE_URL;
  const merchantDomainName =
    process.env.WFP_MERCHANT_DOMAIN ?? (appBaseUrl ? new URL(appBaseUrl).host : undefined);

  if (!merchantAccount || !secretKey || !appBaseUrl || !merchantDomainName) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_env",
        need: ["WFP_MERCHANT_ACCOUNT", "WFP_SECRET_KEY", "APP_BASE_URL", "WFP_MERCHANT_DOMAIN?"],
      },
      { status: 500 }
    );
  }

  try {
    // 3) создаём order (или используем готовый order_ref)
    const { order_ref } = await ensureOrder(product, qpOrderRef ?? undefined);

    // 4) WFP payload
    const orderDate = Math.floor(Date.now() / 1000);

    const productName = [cfg.title];
    const productCount = [1];
    const productPrice = [cfg.amount];

    const serviceUrl = `${appBaseUrl}/api/wfp/webhook`;
    // единый returnUrl на backend -> он разрулит куда редиректить дальше
    const returnUrl = `${appBaseUrl}/pay/approved?product=${product}&order_ref=${encodeURIComponent(
      order_ref
    )}`;

    // signature string по доке WFP (в твоём коде уже так)
    const sigParts = [
      merchantAccount,
      merchantDomainName,
      order_ref,
      String(orderDate),
      String(cfg.amount),
      cfg.currency,
      ...productName,
      ...productCount.map(String),
      ...productPrice.map(String),
    ];
    const sigStr = sigParts.join(";");

    const wfpPayload: any = {
      transactionType: "CREATE_INVOICE",
      merchantAccount,
      merchantDomainName,
      orderReference: order_ref,
      orderDate,
      amount: cfg.amount,
      currency: cfg.currency,
      productName,
      productCount,
      productPrice,
      serviceUrl,
      returnUrl,
      merchantSignature: hmacMd5Hex(secretKey, sigStr),
      apiVersion: 1,
      language: "EN",
    };

    const resp = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wfpPayload),
    });

    const text = await resp.text();

    let payUrl: string | null = null;
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
      payUrl = parsed?.invoiceUrl ?? parsed?.url ?? null;
    } catch {
      // non-json
    }

    if (!payUrl) {
      // логируем фейл в events (таблица есть точно)
      try {
        const sb = supabaseAdmin();
        await sb.from("events").insert({
          type: "wfp_no_url",
          order_ref,
          payload: { httpStatus: resp.status, body: text },
        });
      } catch {}
      return NextResponse.json(
        { ok: false, error: "wfp_no_url", httpStatus: resp.status, body: parsed ?? text },
        { status: 502 }
      );
    }

    // (опционально) логируем успешный ответ
    try {
      const sb = supabaseAdmin();
      await sb.from("events").insert({
        type: "wfp_invoice_created",
        order_ref,
        payload: parsed ?? { raw: text },
      });
    } catch {}

    if (format === "json") {
      return NextResponse.json({ ok: true, order_ref, url: payUrl });
    }

    return NextResponse.redirect(payUrl, 302);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "pay_start_failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}