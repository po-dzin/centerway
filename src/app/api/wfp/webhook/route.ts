import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractPaymentMeta } from "@/lib/paymentMeta";

export const runtime = "nodejs";

async function readBodyParams(req: NextRequest): Promise<Record<string, string>> {
  try {
    const j = (await req.json()) as any;
    if (j && typeof j === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) {
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          out[k] = String(v);
        }
      }
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

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normEmail(v: string | null): string | null {
  if (!v) return null;
  const e = v.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

function normPhone(v: string | null): string | null {
  if (!v) return null;
  const p = v.replace(/[^\d+]/g, "");
  return p || null;
}

function isApproved(payload: Record<string, string>): boolean {
  const ts = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase();
  return ts === "approved" || ts === "success" || ts === "paid";
}

async function upsertCustomer(
  sb: ReturnType<typeof supabaseAdmin>,
  emailRaw: string | null,
  phoneRaw: string | null
) {
  const email = normEmail(emailRaw);
  const phone = normPhone(phoneRaw);

  if (!email && !phone) return;

  // 1) ищем существующего по email/phone
  let existing:
    | { id: string; email: string | null; phone: string | null }
    | null = null;

  if (email) {
    const { data } = await sb
      .from("customers")
      .select("id,email,phone")
      .eq("email", email)
      .maybeSingle();
    if (data?.id) existing = data;
  }

  if (!existing && phone) {
    const { data } = await sb
      .from("customers")
      .select("id,email,phone")
      .eq("phone", phone)
      .maybeSingle();
    if (data?.id) existing = data;
  }

  // 2) update (только то, что реально пришло и улучшает данные)
  if (existing?.id) {
    const patch: Record<string, any> = {};

    // не затираем null-ами
    if (email && (!existing.email || existing.email !== email)) patch.email = email;
    if (phone && (!existing.phone || existing.phone !== phone)) patch.phone = phone;

    if (Object.keys(patch).length) {
      await sb.from("customers").update(patch).eq("id", existing.id);
    }
    return;
  }

  // 3) insert нового (если у тебя нет default uuid — лучше явно задать id)
  await sb.from("customers").insert({
    id: crypto.randomUUID(),
    tg_user_id: null,
    email,
    phone,
  });
}

export async function POST(req: NextRequest) {
  const payload = await readBodyParams(req);

  const orderRef = norm(payload["orderReference"] ?? payload["order_ref"]);
  if (!orderRef) {
    return NextResponse.json({ ok: false, error: "missing_order_ref" }, { status: 400 });
  }

  const paid = isApproved(payload);
  const status = paid ? "paid" : "created"; // бинарная модель — ок

  const sb = supabaseAdmin();

  // 1) payments: если вебхук придет повторно — обновим, а не вставим дубль
  const { data: existingPay, error: paySelErr } = await sb
    .from("payments")
    .select("id")
    .eq("order_ref", orderRef)
    .maybeSingle();

  let pErr: any = null;
  if (paySelErr) {
    pErr = paySelErr;
  } else if (existingPay?.id) {
    const { error } = await sb
      .from("payments")
      .update({ status, raw_payload: payload })
      .eq("id", existingPay.id);
    pErr = error;
  } else {
    const { error } = await sb.from("payments").insert({
      id: crypto.randomUUID(),
      order_ref: orderRef,
      status,
      raw_payload: payload,
    });
    pErr = error;
  }

  // 2) orders.status
  const { error: oErr } = await sb.from("orders").update({ status }).eq("order_ref", orderRef);

  // 3) customers (email/phone) — достаем через extractPaymentMeta, но нормализуем тут еще раз
  const meta = extractPaymentMeta(payload);
  await upsertCustomer(sb, meta.email ?? null, meta.phone ?? null);

  if (pErr || oErr) {
    return NextResponse.json(
      { ok: false, error: "db_write_failed", details: String(pErr?.message || oErr?.message || "") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}