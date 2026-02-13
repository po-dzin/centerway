// src/app/api/orders/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS, ProductCode, resolveProduct } from "@/lib/products";

export const runtime = "nodejs";

type Body = {
  product_code?: unknown; // может прилететь что угодно
  // опционально: можно потом расширять
  attrib?: any;
};

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

function makeOrderRef(product: ProductCode) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(4).toString("hex");
  return `${product}_${y}${m}${day}_${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const product = resolveProduct(body.product_code);
    const cfg = PRODUCTS[product];

    const order_ref = makeOrderRef(product);

    const sb = supabaseAdmin();

    // ВСТАВЛЯЕМ ТОЛЬКО ТО, ЧТО ТОЧНО ЕСТЬ В orders (по твоим скринам)
    const { error } = await sb.from("orders").insert({
      order_ref,
      product_code: product,
      amount: cfg.amount,
      currency: cfg.currency,
      status: "created",
    });

    if (error) {
      return cors(
        NextResponse.json(
          { ok: false, error: "db_order_insert_failed", details: error.message },
          { status: 500 }
        )
      );
    }

    return cors(
      NextResponse.json({
        ok: true,
        order_ref,
        product,
        amount: cfg.amount,
        currency: cfg.currency,
        status: "created",
      })
    );
  } catch (e: any) {
    return cors(
      NextResponse.json(
        { ok: false, error: "bad_request", details: String(e?.message ?? e) },
        { status: 400 }
      )
    );
  }
}