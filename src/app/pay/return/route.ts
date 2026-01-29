import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRODUCTS } from "@/lib/products";

export const runtime = "nodejs";

type ProductCode = keyof typeof PRODUCTS;

function norm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function inferProductFromOrderRef(orderRef: string | null): ProductCode | null {
  if (!orderRef) return null;
  if (orderRef.startsWith("short_")) return "short";
  if (orderRef.startsWith("irem_")) return "irem";
  return null;
}

function isSuccessStatus(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  return ["paid", "approved", "success", "completed"].includes(s);
}

function isFailStatus(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  return ["declined", "failed", "failure", "expired", "canceled", "cancelled", "rejected"].includes(s);
}

function html(title: string, body: string, refreshUrl?: string, refreshSec = 2) {
  const refreshTag = refreshUrl
    ? `<meta http-equiv="refresh" content="${refreshSec};url=${refreshUrl}">`
    : "";
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
${refreshTag}
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b0f14; color:#e6edf3; margin:0}
  .wrap{max-width:720px; margin:0 auto; padding:32px 16px}
  .card{background:#111826; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:20px}
  .muted{opacity:.75}
  a.btn{display:inline-block; margin-top:14px; padding:12px 16px; border-radius:12px; background:#2f81f7; color:white; text-decoration:none}
  code{background:rgba(255,255,255,.08); padding:2px 6px; border-radius:8px}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

async function readAllParams(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  // query params
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value) out[key] = value;
  });

  // body params (на случай POST)
  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/json")) {
      try {
        const j = await req.json();
        if (j && typeof j === "object") {
          for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
            out[k] = String(v);
          }
        }
      } catch {}
    } else {
      // formData покрывает и x-www-form-urlencoded, и multipart
      try {
        const fd = await req.formData();
        for (const [k, v] of fd.entries()) out[k] = String(v);
      } catch {}
    }
  }

  return out;
}

async function handler(req: NextRequest) {
  const p = await readAllParams(req);

  // WFP может прислать разные ключи
  const orderRef =
    norm(p.order_ref) ||
    norm(p.orderReference) ||
    norm(p.order_reference) ||
    norm(p.order) ||
    null;

  const productRaw = norm(p.product);
  const productFromQuery: ProductCode | null =
    productRaw === "short" || productRaw === "irem" ? productRaw : null;

  const productFromRef = inferProductFromOrderRef(orderRef);

  if (!orderRef) {
    const page = html(
      "Payment",
      `<h2>⚠️ Немає order_ref</h2>
       <p class="muted">WayForPay повернув на сайт без номера замовлення, тому я не можу визначити статус.</p>
       <p class="muted">Спробуй ще раз оплату або напиши в підтримку.</p>`
    );
    return new Response(page, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // 1) пробуем получить продукт из БД
  let product: ProductCode | null = productFromQuery || productFromRef;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orders")
    .select("status, product_code")
    .eq("order_ref", orderRef)
    .maybeSingle();

  if (!product && data?.product_code && (data.product_code in PRODUCTS)) {
    product = data.product_code as ProductCode;
  }

  if (!product) {
    const page = html(
      "Payment",
      `<h2>⚠️ Невідомий продукт</h2>
       <p>order_ref: <code>${orderRef}</code></p>
       <p class="muted">Не вдалося визначити продукт (short/irem). Перевір префікс order_ref або product у URL.</p>`
    );
    return new Response(page, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // если запись ещё не попала/не обновилась — ждём webhook
  if (error || !data?.status) {
    const refresh = `${req.nextUrl.origin}${req.nextUrl.pathname}?product=${encodeURIComponent(product)}&order_ref=${encodeURIComponent(orderRef)}`;
    const page = html(
      "Processing",
      `<h2>⏳ Оплата обробляється…</h2>
       <p class="muted">Чекаю підтвердження від WayForPay (webhook).</p>
       <p>order_ref: <code>${orderRef}</code></p>
       <a class="btn" href="${refresh}">Оновити зараз</a>`,
      refresh,
      2
    );
    return new Response(page, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const status = String(data.status);

  // финальные редиректы
  const cfg = PRODUCTS[product];
  const target = isSuccessStatus(status) ? cfg.approvedUrl : isFailStatus(status) ? cfg.declinedUrl : null;

  // если статус какой-то "pending/created" — ждём
  if (!target) {
    const refresh = `${req.nextUrl.origin}${req.nextUrl.pathname}?product=${encodeURIComponent(product)}&order_ref=${encodeURIComponent(orderRef)}`;
    const page = html(
      "Processing",
      `<h2>⏳ Статус: ${status}</h2>
       <p class="muted">Поки що не фінальний статус. Оновлю сторінку автоматично.</p>
       <p>order_ref: <code>${orderRef}</code></p>
       <a class="btn" href="${refresh}">Оновити</a>`,
      refresh,
      2
    );
    return new Response(page, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const url = new URL(target);
  url.searchParams.set("order_ref", orderRef);
  url.searchParams.set("product", product);

  return NextResponse.redirect(url.toString(), 302);
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}