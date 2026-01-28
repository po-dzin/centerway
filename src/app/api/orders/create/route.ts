import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // если у тебя другой файл — поправь путь/имя

export const runtime = "nodejs";

const PRODUCTS = {
  short: { amount: 359, currency: "UAH", title: "Short Reboot" },
  irem: { amount: 4000, currency: "UAH", title: "IREM" },
} as const;

type ProductCode = keyof typeof PRODUCTS;

type Body = {
  product_code: ProductCode;
  tg_user_id?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  attrib?: any; // utm/fbclid/etc
  page_url?: string | null;
  referer?: string | null;
  user_agent?: string | null;
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

function dayStampUTC() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function rand8() {
  return crypto.randomBytes(4).toString("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const product_code = body.product_code;
    if (!product_code || !(product_code in PRODUCTS)) {
      return cors(
        NextResponse.json(
          { ok: false, error: "bad_product_code" },
          { status: 400 }
        )
      );
    }

    const cfg = PRODUCTS[product_code];
    const sb = supabaseAdmin();

    // 1) customer: ищем/создаем
    let customerId: string | null = null;

    if (body.tg_user_id) {
      const { data: existing, error: selErr } = await sb
        .from("customers")
        .select("id")
        .eq("tg_user_id", String(body.tg_user_id))
        .maybeSingle();

      if (selErr) throw selErr;

      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created, error: insErr } = await sb
          .from("customers")
          .insert({
            tg_user_id: String(body.tg_user_id),
            email: body.email ?? null,
            phone: body.phone ?? null,
            meta: {
              name: body.name ?? null,
              attrib: body.attrib ?? null,
              first_seen_url: body.page_url ?? null,
              first_seen_referer: body.referer ?? null,
              first_seen_ua: body.user_agent ?? null,
            },
          })
          .select("id")
          .single();

        if (insErr) throw insErr;
        customerId = created.id;
      }
    } else if (body.email || body.phone) {
      // fallback: если tg_user_id нет, всё равно создадим customer, чтобы не терять контакты
      const { data: created, error: insErr } = await sb
        .from("customers")
        .insert({
          tg_user_id: null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          meta: {
            name: body.name ?? null,
            attrib: body.attrib ?? null,
            first_seen_url: body.page_url ?? null,
            first_seen_referer: body.referer ?? null,
            first_seen_ua: body.user_agent ?? null,
          },
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
      customerId = created.id;
    }

    // если customer нашли — аккуратно дополним email/phone/meta (не затирая)
    if (customerId && (body.email || body.phone || body.attrib || body.name)) {
      await sb
        .from("customers")
        .update({
          email: body.email ?? undefined,
          phone: body.phone ?? undefined,
          meta: {
            name: body.name ?? null,
            attrib: body.attrib ?? null,
            last_seen_url: body.page_url ?? null,
            last_seen_referer: body.referer ?? null,
            last_seen_ua: body.user_agent ?? null,
          },
        })
        .eq("id", customerId);
    }

    // 2) order
    const order_ref = `${product_code}_${dayStampUTC()}_${rand8()}`;

    const { error: orderErr } = await sb.from("orders").insert({
      order_ref,
      product_code,
      amount: cfg.amount,
      currency: cfg.currency,
      status: "created",
      customer_id: customerId,
      meta: {
        attrib: body.attrib ?? null,
        page_url: body.page_url ?? null,
        referer: body.referer ?? null,
        user_agent: body.user_agent ?? null,
      },
    });

    if (orderErr) throw orderErr;

    return cors(
      NextResponse.json({ ok: true, order_ref, customer_id: customerId })
    );
  } catch (e: any) {
    return cors(
      NextResponse.json(
        { ok: false, error: "server_error", detail: String(e?.message ?? e) },
        { status: 500 }
      )
    );
  }
}
