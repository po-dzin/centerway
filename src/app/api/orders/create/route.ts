// src/app/api/orders/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS, normalizeProduct, type ProductCode } from "@/lib/products";

export const runtime = "nodejs";

type Body = {
  product_code?: unknown; // "short" | "irem"
  // любые доп-поля можно присылать — мы запишем их в events.payload
  [k: string]: unknown;
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const product: ProductCode = normalizeProduct(body.product_code) ?? "short";
    const cfg = PRODUCTS[product];

    const order_ref = makeOrderRef(product);
    const customer_id = crypto.randomUUID();

    const sb = supabaseAdmin();

    // orders: вставляем только те колонки, которые точно есть (чтобы не падать от schema cache)
    const { error: ordErr } = await sb.from("orders").insert({
      order_ref,
      product_code: product,
      amount: cfg.amount,
      currency: cfg.currency,
      status: "created",
      customer_id,
    });

    if (ordErr) {
      return cors(
        NextResponse.json(
          { ok: false, error: "db_order_insert_failed", details: ordErr.message },
          { status: 500 }
        )
      );
    }

    // events: сюда кладём любые доп-данные (utm, tg_user_id, page_url и т.д.)
    await sb.from("events").insert({
      type: "order_created",
      order_ref,
      customer_id,
      payload: body,
    });

    return cors(
      NextResponse.json({
        ok: true,
        order_ref,
        product_code: product,
        amount: cfg.amount,
        currency: cfg.currency,
        customer_id,
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