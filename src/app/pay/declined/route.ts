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

async function readBodyParams(req: NextRequest): Promise<Record<string, string>> {
  if (req.method !== "POST") return {};
  const ct = req.headers.get("content-type") || "";

  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v);
      return out;
    }
  } catch {}

  try {
    const fd = await req.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of fd.entries()) out[k] = String(v);
    return out;
  } catch {}

  return {};
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const body = await readBodyParams(req);

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

  const target = new URL(PRODUCTS[product].declinedUrl);
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
