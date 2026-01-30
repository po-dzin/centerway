import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS } from "@/lib/products";

export const runtime = "nodejs";

type ProductCode = keyof typeof PRODUCTS;

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function productFrom(orderRef: string | null, productRaw: string | null): ProductCode {
  if (productRaw && productRaw in PRODUCTS) return productRaw as ProductCode;
  if (orderRef?.startsWith("irem_")) return "irem" as ProductCode;
  return "short" as ProductCode;
}

async function readBody(req: NextRequest): Promise<Record<string, string>> {
  // JSON
  try {
    const j = (await req.json()) as any;
    if (j && typeof j === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
      return out;
    }
  } catch {}

  // form-data / x-www-form-urlencoded
  try {
    const fd = await req.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of fd.entries()) out[k] = String(v);
    return out;
  } catch {}

  return {};
}

function statusFromParams(p: Record<string, string>, sp: URLSearchParams): "paid" | "failed" | null {
  const ts =
    norm(p["transactionStatus"] ?? p["status"]) ||
    norm(sp.get("transactionStatus")) ||
    norm(sp.get("status"));

  if (!ts) return null;

  const low = ts.toLowerCase();
  if (low === "approved" || low === "success" || low === "paid") return "paid";
  if (low === "declined" || low === "failed" || low === "failure") return "failed";

  return null;
}

function extractMeta(raw: any): { rrn?: string; amount?: string; currency?: string } {
  if (!raw || typeof raw !== "object") return {};
  const rrn = typeof raw.rrn === "string" ? raw.rrn : typeof raw.RRN === "string" ? raw.RRN : undefined;

  const amount =
    typeof raw.amount === "string" ? raw.amount :
    typeof raw.amount === "number" ? String(raw.amount) :
    typeof raw.orderAmount === "string" ? raw.orderAmount :
    typeof raw.orderAmount === "number" ? String(raw.orderAmount) :
    undefined;

  const currency =
    typeof raw.currency === "string" ? raw.currency :
    typeof raw.orderCurrency === "string" ? raw.orderCurrency :
    undefined;

  return { rrn, amount, currency };
}

async function statusFromDb(orderRef: string): Promise<"paid" | "failed"> {
  const sb = supabaseAdmin();

  // orders.status — главный источник
  const { data: order } = await sb
    .from("orders")
    .select("status")
    .eq("order_ref", orderRef)
    .maybeSingle();

  if (order?.status === "paid") return "paid";

  return "failed";
}

async function latestPaymentMeta(orderRef: string) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("payments")
    .select("raw_payload, created_at")
    .eq("order_ref", orderRef)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return extractMeta(data?.raw_payload);
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const body = await readBody(req);

  const orderRef =
    norm(sp.get("order_ref")) ||
    norm(sp.get("orderReference")) ||
    norm(body["order_ref"]) ||
    norm(body["orderReference"]);

  const productRaw = norm(sp.get("product")) || norm(body["product"]);
  const product = productFrom(orderRef, productRaw);

  // Если order_ref не пришел — не можем понять что делать
  if (!orderRef) {
    return NextResponse.redirect(PRODUCTS[product].declinedUrl, { status: 302 });
  }

  // 1) пробуем понять из параметров, 2) иначе смотрим БД
  const byParams = statusFromParams(body, sp);
  const finalStatus = byParams ?? (await statusFromDb(orderRef));

  // мета платежа (rrn/amount/currency) — берём из payments.raw_payload если есть
  const meta = await latestPaymentMeta(orderRef);

  const destBase = finalStatus === "paid" ? PRODUCTS[product].approvedUrl : PRODUCTS[product].declinedUrl;
  const dest = new URL(destBase);

  dest.searchParams.set("order_ref", orderRef);
  dest.searchParams.set("product", String(product));

  if (meta.rrn) dest.searchParams.set("rrn", meta.rrn);
  if (meta.amount) dest.searchParams.set("amount", meta.amount);
  if (meta.currency) dest.searchParams.set("currency", meta.currency);

  // cache-buster, чтобы страница не залипала
  dest.searchParams.set("ts", String(Date.now()));

  return NextResponse.redirect(dest.toString(), { status: 302 });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}