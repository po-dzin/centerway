import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractPaymentMeta } from "@/lib/paymentMeta";

export const runtime = "nodejs";

type Payload = Record<string, string>;

async function readBodyParams(req: NextRequest): Promise<Payload> {
  // JSON
  try {
    const j = (await req.json()) as unknown;
    if (j && typeof j === "object") {
      const out: Payload = {};
      for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = String(v);
        }
      }
      return out;
    }
  } catch {}

  // form-data (WFP иногда шлёт form-url-encoded)
  try {
    const fd = await req.formData();
    const out: Payload = {};
    for (const [k, v] of fd.entries()) out[k] = String(v);
    return out;
  } catch {}

  return {};
}

function norm(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isApproved(payload: Payload): boolean {
  const ts = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase();
  return ts === "approved" || ts === "success" || ts === "paid";
}

function normEmail(email: string | null): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e ? e : null;
}

function normPhone(phone: string | null): string | null {
  if (!phone) return null;
  const p = phone.trim();
  return p ? p : null;
}

async function upsertCustomer(sb: ReturnType<typeof supabaseAdmin>, email: string | null, phone: string | null) {
  const e = normEmail(email);
  const p = normPhone(phone);
  if (!e && !p) return;

  // 1) пробуем найти по email, 2) потом по phone
  let foundId: string | null = null;

  if (e) {
    const { data, error } = await sb.from("customers").select("id").eq("email", e).maybeSingle();
    if (!error && data?.id) foundId = data.id;
  }

  if (!foundId && p) {
    const { data, error } = await sb.from("customers").select("id").eq("phone", p).maybeSingle();
    if (!error && data?.id) foundId = data.id;
  }

  if (foundId) {
    const { error } = await sb.from("customers").update({ email: e, phone: p }).eq("id", foundId);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from("customers").insert({ email: e, phone: p });
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  const payload = await readBodyParams(req);

  const orderRef = norm(payload["orderReference"] ?? payload["order_ref"]);
  if (!orderRef) {
    return NextResponse.json({ ok: false, error: "missing_order_ref" }, { status: 400 });
  }

  const paid = isApproved(payload);
  const status = paid ? "paid" : "created"; // твоя бинарная модель

  const sb = supabaseAdmin();

  // мета из payload: rrn/email/phone/amount/currency и т.д.
  const meta = extractPaymentMeta(payload);
  const providerTxId =
    norm(meta.rrn) ??
    norm(payload["rrn"]) ??
    norm(payload["transactionId"]) ??
    norm(payload["payment_id"]) ??
    norm(payload["id"]);
  const safeProviderTxId = providerTxId ?? `order:${orderRef}`;

  try {
    // 1) payments: сохраняем как источник правды
    // ⚠️ provider обязателен (у тебя NOT NULL) — ставим явно
    // ⚠️ raw_payload NOT NULL — кладём payload
    const { error: pErr } = await sb.from("payments").insert({
      provider: "wfp",
      order_ref: orderRef,
      provider_tx_id: safeProviderTxId,
      status,
      raw_payload: payload,
    });

    // 2) orders.status
    const { error: oErr } = await sb.from("orders").update({ status }).eq("order_ref", orderRef);

    // 3) customers: материализуем email/phone из платежа
    const errors: string[] = [];

    if (pErr) {
      const code = (pErr as any)?.code;
      if (code !== "23505") {
        errors.push(`payments: ${pErr.message ?? "unknown"}`);
      }
    }

    if (oErr) {
      errors.push(`orders: ${oErr.message ?? "unknown"}`);
    }

    try {
      await upsertCustomer(sb, meta.email ?? null, meta.phone ?? null);
    } catch (e: any) {
      errors.push(`customers: ${String(e?.message || e)}`);
    }

    if (errors.length) {
      console.error("wfp_webhook_nonfatal", { orderRef, errors });
      // Возвращаем 200, чтобы платёжка не ретраила бесконечно.
      return NextResponse.json({ ok: false, error: "db_write_failed", details: errors.join("; ") }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "webhook_failed", details: String(e?.message || e) }, { status: 500 });
  }
}
