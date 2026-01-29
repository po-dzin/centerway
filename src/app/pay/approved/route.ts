import { NextRequest, NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";

export const runtime = "nodejs";

type ProductCode = keyof typeof PRODUCTS;

function norm(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function inferProductFromOrderRef(orderRef: string | null): ProductCode {
  if (!orderRef) return "short";
  if (orderRef.startsWith("irem_")) return "irem";
  return "short";
}

async function readBodyParams(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) return {};

    // 1) JSON?
    try {
      const j = JSON.parse(text);
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v);
      return out;
    } catch {}

    // 2) form-urlencoded?
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const body = await readBodyParams(req);

  // WFP может прислать orderReference в body, а у тебя в query order_ref
  const orderRef =
    norm(sp.get("order_ref")) ||
    norm(sp.get("orderReference")) ||
    norm(body["order_ref"]) ||
    norm(body["orderReference"]) ||
    null;

  const productRaw =
    norm(sp.get("product")) ||
    norm(body["product"]) ||
    null;

  const product: ProductCode =
    (productRaw && (productRaw === "short" || productRaw === "irem") ? productRaw : null) ??
    inferProductFromOrderRef(orderRef);

  // финальный редирект (куда "после оплаты")
  const target = new URL(PRODUCTS[product].approvedUrl);

  // полезно пробросить order_ref дальше (на спасибо-страницу или бэку)
  if (orderRef) target.searchParams.set("order_ref", orderRef);
  target.searchParams.set("product", product);

  return NextResponse.redirect(target.toString(), 302);
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
