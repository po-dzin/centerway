import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PRODUCTS = {
  short: {
    amount: 1,
    currency: "UAH",
    name: "Short Reboot",
    returnUrl: "https://reboot.centerway.net/thanks",
  },
  irem: {
    amount: 2,
    currency: "UAH",
    name: "IREM",
    returnUrl: "https://irem.centerway.net/thanks",
  },
} as const;

function hmacMd5(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function makeOrderRef(product: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = crypto.randomBytes(4).toString("hex");
  return `${product}_${y}${m}${day}_${rnd}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const product = (url.searchParams.get("product") ?? "").toLowerCase();

  if (product !== "short" && product !== "irem") {
    return NextResponse.json({ ok: false, error: "bad_product" }, { status: 400 });
  }

  const cfg = PRODUCTS[product as keyof typeof PRODUCTS];

  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT;
  const secretKey = process.env.WFP_SECRET_KEY;
  const appBaseUrl = process.env.APP_BASE_URL; // https://<your-backend>.vercel.app

  if (!merchantAccount || !secretKey || !appBaseUrl) {
    return NextResponse.json(
      { ok: false, error: "missing_env", need: ["WFP_MERCHANT_ACCOUNT", "WFP_SECRET_KEY", "APP_BASE_URL"] },
      { status: 500 }
    );
  }

  const orderReference = makeOrderRef(product);
  const orderDate = Math.floor(Date.now() / 1000);

  // 1) create order in DB
  const sb = supabaseAdmin();
  const { error: orderErr } = await sb.from("orders").insert({
    order_ref: orderReference,
    product_code: product,
    status: "created",
    amount: cfg.amount,
    currency: cfg.currency,
  });

  if (orderErr) {
    return NextResponse.json({ ok: false, error: "db_insert_failed", details: orderErr }, { status: 500 });
  }

  // 2) build signature
  const merchantDomainName =
    process.env.WFP_MERCHANT_DOMAIN ?? new URL(cfg.returnUrl).hostname;

  const signatureParts = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(cfg.amount),
    cfg.currency,
    cfg.name,
    "1",
    String(cfg.amount),
  ];

  const sigStr = signatureParts.join(";");
  const merchantSignature = hmacMd5(secretKey, sigStr);

  const form = new URLSearchParams();
  form.set("merchantAccount", merchantAccount);
  form.set("merchantDomainName", merchantDomainName);
  form.set("orderReference", orderReference);
  form.set("orderDate", String(orderDate));
  form.set("amount", String(cfg.amount));
  form.set("currency", cfg.currency);
  form.set("productName[]", cfg.name);
  form.set("productCount[]", "1");
  form.set("productPrice[]", String(cfg.amount));
  form.set("merchantSignature", merchantSignature);
  form.set("returnUrl", cfg.returnUrl);
  form.set("serviceUrl", `${appBaseUrl}/api/wfp/webhook`);

  // 3) request payment URL
  const resp = await fetch("https://secure.wayforpay.com/pay?behavior=offline", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: form.toString(),
  });

  const text = await resp.text();

  let payUrl: string | null = null;
  try {
    const j = JSON.parse(text);
    payUrl = j?.url ?? null;
  } catch {}

  if (!payUrl) {
    return NextResponse.json({ ok: false, error: "wfp_no_url", raw: text }, { status: 502 });
  }

  return NextResponse.redirect(payUrl, 302);
}
