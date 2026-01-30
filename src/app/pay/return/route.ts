// src/app/pay/return/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";

export const runtime = "nodejs";

type ProductCode = keyof typeof PRODUCTS;

function isProduct(v: string | null | undefined): v is ProductCode {
  return v === "short" || v === "irem";
}

function pick(obj: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function inferProductFromOrderRef(orderRef: string | null): ProductCode | null {
  if (!orderRef) return null;
  if (orderRef.startsWith("irem_")) return "irem";
  if (orderRef.startsWith("short_")) return "short";
  return null;
}

function isApproved(status: string | null) {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "APPROVED" || s === "SUCCESS";
}

function isDeclined(status: string | null) {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "DECLINED" || s === "EXPIRED" || s === "REFUNDED" || s === "REVERSED";
}

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  // query params
  req.nextUrl.searchParams.forEach((v, k) => {
    out[k] = v;
  });

  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    try {
      const j = (await req.json()) as Record<string, unknown>;
      if (j && typeof j === "object") {
        for (const [k, v] of Object.entries(j)) {
          if (v !== undefined && v !== null) out[k] = String(v);
        }
      }
    } catch {
      // ignore
    }
    return out;
  }

  // form-data / x-www-form-urlencoded
  try {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) out[k] = String(v);
  } catch {
    // ignore
  }

  return out;
}

function withContext(baseUrl: string, product: string, orderRef: string | null, status: string | null) {
  const u = new URL(baseUrl);
  u.searchParams.set("product", product);
  if (orderRef) u.searchParams.set("order_ref", orderRef);
  if (status) u.searchParams.set("wfp_status", status);
  return u;
}

async function handler(req: NextRequest) {
  const p = await readParams(req);

  const orderRef = pick(p, ["order_ref", "orderReference", "ORDERREFERENCE", "orderreference"]);
  const status = pick(p, ["transactionStatus", "TRANSACTIONSTATUS", "status", "STATUS"]);
  const productRaw = pick(p, ["product", "PRODUCT", "product_code", "productCode", "PRODUCTCODE"]);

  const product: ProductCode =
    (isProduct(productRaw) ? productRaw : inferProductFromOrderRef(orderRef)) ?? "short";

  const cfg = PRODUCTS[product];

  // IMPORTANT: для POST-возврата редиректим 303, чтобы браузер сделал GET
  if (isApproved(status)) {
    return NextResponse.redirect(withContext(cfg.approvedUrl, product, orderRef, status), { status: 303 });
  }
  if (isDeclined(status)) {
    return NextResponse.redirect(withContext(cfg.declinedUrl, product, orderRef, status), { status: 303 });
  }

  // если вдруг статус не пришёл (обычно из-за выключенного POST) — безопаснее вести на failed
  return NextResponse.redirect(withContext(cfg.declinedUrl, product, orderRef, status), { status: 303 });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}