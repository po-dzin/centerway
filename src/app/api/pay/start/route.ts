// src/app/api/pay/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PRODUCTS = {
  short: {
    title: "Short Reboot",
    amount: 1,
    currency: "UAH",
  },
  irem: {
    title: "IREM",
    amount: 2,
    currency: "UAH",
  },
} as const;

type ProductCode = keyof typeof PRODUCTS;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function makeOrderRef(product: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const rand = crypto.randomBytes(4).toString("hex");
  return `${product}_${y}${m}${day}_${rand}`;
}

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function buildWfpSignature(params: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: string;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: string[];
  secretKey: string;
}) {
  const {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
    secretKey,
  } = params;

  const parts: string[] = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    amount,
    currency,
  ];

  for (let i = 0; i < productName.length; i++) {
    parts.push(productName[i], String(productCount[i]), productPrice[i]);
  }

  const signStr = parts.join(";");
  return hmacMd5Hex(secretKey, signStr);
}

export async function GET(req: NextRequest) {
  try {
    // ✅ создаём клиент ОДИН раз (supabaseAdmin — это ФУНКЦИЯ)
    const supabase = supabaseAdmin();

    // --- env checks
    const need = [
      "WFP_MERCHANT_ACCOUNT",
      "WFP_MERCHANT_DOMAIN",
      "WFP_SECRET_KEY",
      "APP_BASE_URL",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ].filter((k) => !process.env[k]);

    if (need.length) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need },
        { status: 500 }
      );
    }

    const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT!;
    const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN!;
    const secretKey = process.env.WFP_SECRET_KEY!;
    const appBaseUrl = process.env.APP_BASE_URL!;

    // --- parse product
    const { searchParams } = new URL(req.url);
    const product = (searchParams.get("product") || "") as ProductCode;

    if (!product || !(product in PRODUCTS)) {
      return NextResponse.json(
        { ok: false, error: "bad_product", allowed: Object.keys(PRODUCTS) },
        { status: 400 }
      );
    }

    const cfg = PRODUCTS[product];

    // --- create order in DB
    const order_ref = makeOrderRef(product);
    const orderDate = Math.floor(Date.now() / 1000);

    const payload = Object.fromEntries(searchParams.entries());

    const { error: orderErr } = await supabase.from("orders").insert({
      order_ref,
      product_code: product,
      amount: cfg.amount,
      currency: cfg.currency,
      status: "created",
      payload,
    });

    if (orderErr) {
      return NextResponse.json(
        { ok: false, error: "db_order_insert_failed", details: orderErr.message },
        { status: 500 }
      );
    }

    // --- build WFP request
    const amountStr = String(cfg.amount);
    const productName = [cfg.title];
    const productCount = [1];
    const productPrice = [amountStr];

    const signature = buildWfpSignature({
      merchantAccount,
      merchantDomainName,
      orderReference: order_ref,
      orderDate,
      amount: amountStr,
      currency: cfg.currency,
      productName,
      productCount,
      productPrice,
      secretKey,
    });

    const wfpBody = {
      transactionType: "CREATE_INVOICE",
      merchantAccount,
      merchantDomainName,
      merchantSignature: signature,
      apiVersion: 1,

      orderReference: order_ref,
      orderDate,
      amount: amountStr,
      currency: cfg.currency,
      productName,
      productCount,
      productPrice,

      serviceUrl: `${appBaseUrl}/api/wfp/webhook`,
      returnUrl: `${appBaseUrl}/api/pay/return?order_ref=${encodeURIComponent(
        order_ref
      )}`,
    };

    const resp = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wfpBody),
    });

    const text = await resp.text();
    let j: any = null;
    try {
      j = JSON.parse(text);
    } catch {}

    const payUrl =
      j?.url ||
      j?.invoiceUrl ||
      j?.paymentUrl ||
      j?.link ||
      j?.invoice?.url ||
      null;

    if (!resp.ok || !payUrl) {
      await supabase.from("events").insert({
        type: "wfp_create_invoice_failed",
        order_ref,
        payload: { status: resp.status, body: j ?? text },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "wfp_no_url",
          http_status: resp.status,
          body: j ?? text,
        },
        { status: 502 }
      );
    }

    await supabase.from("events").insert({
      type: "wfp_create_invoice_ok",
      order_ref,
      payload: { payUrl },
    });

    const format = searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ ok: true, order_ref, url: payUrl });
    }

    return NextResponse.redirect(payUrl, 302);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "pay_start_unhandled", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}