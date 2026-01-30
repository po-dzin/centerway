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
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
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

function isApproved(payload: Record<string, string>): boolean {
  const ts = norm(payload["transactionStatus"] ?? payload["status"])?.toLowerCase();
  if (ts === "approved" || ts === "success" || ts === "paid") return true;
  return false;
}

async function upsertCustomer(email: string | null, phone: string | null) {
  if (!email && !phone) return;

  const sb = supabaseAdmin();

  // ищем по email или phone
  let foundId: string | null = null;

  if (email) {
    const { data } = await sb.from("customers").select("id").eq("email", email).maybeSingle();
    if (data?.id) foundId = data.id;
  }

  if (!foundId && phone) {
    const { data } = await sb.from("customers").select("id").eq("phone", phone).maybeSingle();
    if (data?.id) foundId = data.id;
  }

  if (foundId) {
    await sb.from("customers").update({ email, phone }).eq("id", foundId);
  } else {
    await sb.from("customers").insert({ email, phone });
  }
}

export async function POST(req: NextRequest) {
  const payload = await readBodyParams(req);

  const orderRef = norm(payload["orderReference"] ?? payload["order_ref"]);
  if (!orderRef) {
    return NextResponse.json({ ok: false, error: "missing_order_ref" }, { status: 400 });
  }

  const paid = isApproved(payload);
  const status = paid ? "paid" : "created"; // у тебя бинарная модель — ок

  const sb = supabaseAdmin();

  // 1) сохраняем payments (raw_payload — источник правды)
  const { error: pErr } = await sb.from("payments").insert({
    order_ref: orderRef,
    status,
    raw_payload: payload,
  });

  // 2) обновляем orders.status
  const { error: oErr } = await sb.from("orders").update({ status }).eq("order_ref", orderRef);

  // 3) (опционально) наполняем customers из payload
  const meta = extractPaymentMeta(payload);
  await upsertCustomer(meta.email, meta.phone);

  if (pErr || oErr) {
    return NextResponse.json(
      { ok: false, error: "db_write_failed", details: String(pErr?.message || oErr?.message || "") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}