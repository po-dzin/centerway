import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { persistLeadBestEffort, type LeadRecord } from "@/lib/checkoutFlow";
import { normalizeProduct, type ProductCode } from "@/lib/products";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upsertCustomerByContact } from "@/lib/platform/customerIdentity";
import { applyDoshaTagsToCustomer, loadTestAttempt } from "@/lib/doshaTestRepo";
import { isDoshaResultType, type DoshaResultType } from "@/lib/doshaTest";
import { sendTelegramMessage } from "@/lib/tg";

export const runtime = "nodejs";

// Best-effort mirror of a premium lead into the support Telegram group so the
// team sees form submissions live (not only in the admin panel). Never throws:
// a Telegram failure must not affect the form response. Routes to LEADS_THREAD_ID
// when set, otherwise falls back to the shared support thread.
async function notifyLeadToGroup(lead: LeadRecord): Promise<void> {
  const chatId = process.env.SUPPORT_CHAT_ID;
  if (!chatId) return;

  const payload = lead.payload ?? {};
  const line = (label: string, value: unknown): string | null => {
    const v = typeof value === "string" ? value.trim() : value;
    return v ? `${label}: ${v}` : null;
  };
  const text = [
    "📝 Нова заявка (лендинг)",
    line("Програма", lead.product_code),
    line("Ім'я", lead.name),
    line("Тел", lead.phone),
    line("Email", lead.email),
    line("Джерело", lead.source),
    line("Доша", payload.dosha_result_type),
    line("Сторінка", payload.page_url),
    line("UTM", [payload.utm_source, payload.utm_campaign].filter(Boolean).join(" / ")),
    payload.message ? `\n${String(payload.message).slice(0, 800)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const threadRaw = process.env.LEADS_THREAD_ID || process.env.SUPPORT_THREAD_ID;
  const messageThreadId = threadRaw && /^\d+$/.test(threadRaw) ? Number(threadRaw) : null;

  try {
    await sendTelegramMessage(chatId, text, { messageThreadId });
  } catch {
    /* fire-and-forget: never block the lead response on Telegram */
  }
}

type LeadRequestBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  product_code?: unknown;
  product?: unknown;
  source?: unknown;
  page_url?: unknown;
  referrer?: unknown;
  message?: unknown;
  interest?: unknown;
  cta_place?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  fbclid?: unknown;
  event_id?: unknown;
  attempt_id?: unknown;
  dosha?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

function makeLeadRef(product: ProductCode): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `lead_${product}_${y}${m}${day}_${crypto.randomBytes(4).toString("hex")}`;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, { name: "leads", limit: 15, windowSeconds: 60 });
  if (!rl.allowed) return cors(tooManyRequests(rl.retryAfter));

  const body = (await req.json().catch(() => ({}))) as LeadRequestBody;
  const name = asString(body.name);
  const phone = asString(body.phone);
  const email = asString(body.email)?.toLowerCase() ?? null;
  const product = normalizeProduct({
    product: asString(body.product) ?? undefined,
    product_code: asString(body.product_code) ?? undefined,
  }) ?? "consult";

  if (!name || (!phone && !email)) {
    return cors(
      NextResponse.json(
        { ok: false, error: "contact_required" },
        { status: 400 }
      )
    );
  }

  const pageUrl = asString(body.page_url) ?? req.headers.get("referer") ?? null;
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    null;
  const lead: LeadRecord = {
    order_ref: makeLeadRef(product),
    product_code: product,
    source: asString(body.source) ?? "platform_consult_form",
    name,
    email,
    phone,
    fbp: asString(body.fbp) ?? req.cookies.get("_fbp")?.value ?? null,
    fbclid: asString(body.fbclid),
    campaign: asString(body.utm_campaign),
    payload: {
      page_url: pageUrl,
      referrer: asString(body.referrer),
      message: asString(body.message),
      interest: asString(body.interest),
      cta_place: asString(body.cta_place),
      utm_source: asString(body.utm_source),
      utm_medium: asString(body.utm_medium),
      utm_campaign: asString(body.utm_campaign),
      utm_content: asString(body.utm_content),
      utm_term: asString(body.utm_term),
      fbp: asString(body.fbp) ?? req.cookies.get("_fbp")?.value ?? null,
      fbc: asString(body.fbc) ?? req.cookies.get("_fbc")?.value ?? null,
      fbclid: asString(body.fbclid),
      event_id: asString(body.event_id),
      client_ip: clientIp,
      user_agent: req.headers.get("user-agent"),
    },
  };

  const db = supabaseAdmin();

  /* THE TEST THE PERSON JUST TOOK, CARRIED INTO THE FORM.
     The consultation door already receives `?dosha=X` from the result screen,
     but that only ever reached `utm_content` — a string in an analytics field,
     attached to nobody. The attempt id is what makes it an identity: it names a
     row we can verify rather than a label the page can claim. An id that does
     not resolve, or resolves to an unfinished run, is simply not used — the
     form still submits, because a lead is never worth losing over a decoration. */
  const attemptId = asString(body.attempt_id);
  let doshaResultType: DoshaResultType | null = null;
  if (attemptId) {
    try {
      const attempt = await loadTestAttempt(db, attemptId);
      const resultType = attempt?.result_type ?? null;
      if (attempt?.status === "completed" && isDoshaResultType(resultType)) {
        doshaResultType = resultType;
      }
    } catch {
      // a lead is never lost over a test lookup
    }
  }
  /* The screen's own `?dosha=` is a fallback only, and only when it agrees with
     the vocabulary — it is reader-supplied, so it labels the lead but never
     tags the customer. */
  const claimedDosha = asString(body.dosha);
  if (!doshaResultType && isDoshaResultType(claimedDosha)) {
    lead.payload.dosha_claimed = claimedDosha;
  }
  if (doshaResultType) {
    lead.payload.dosha_result_type = doshaResultType;
    lead.payload.dosha_attempt_id = attemptId;
  }

  const mode = await persistLeadBestEffort(db, lead);

  if (mode === "skipped") {
    return cors(
      NextResponse.json(
        { ok: false, error: "lead_persist_failed" },
        { status: 500 }
      )
    );
  }

  if (asString(body.event_id)) {
    await db.from("jobs").insert({
      type: "meta:capi",
      status: "pending",
      payload: {
        event_name: "Lead",
        event_id: asString(body.event_id),
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: pageUrl,
        content_name: product,
        content_type: "lead",
        content_ids: [product],
        email,
        phone,
        fbp: lead.fbp,
        fbc: asString(body.fbc) ?? req.cookies.get("_fbc")?.value ?? null,
        fbclid: lead.fbclid,
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
      },
    });
  }

  /* ON THE SPINE, NOT BESIDE IT (journey map, P1: «Лид пишет в customers тем
     же upsertCustomer, что и вебхук»).
     A form submission used to end at the `leads` table, so a person who asked
     for a consultation existed nowhere the rest of the product looks: not in
     the admin's customer list, not reachable by the notification layer, not
     joinable to the test they had just taken. The same resolver the payment
     webhook uses now runs here, which also means a lead from someone who has
     bought before lands on their EXISTING row instead of starting a second
     identity beside it.

     Best-effort on purpose: the lead is already stored and the group is already
     going to be told. A spine write that fails must not turn a captured lead
     into a 500 for the person who filled the form. */
  try {
    const { id: customerId, created } = await upsertCustomerByContact(db, { email, phone });
    if (customerId && created) {
      /* PROFILE FIELDS ONLY ON A ROW THIS SUBMISSION CREATED.
         This endpoint is public, unauthenticated and CORS-open, and it upserts
         on whatever contact was typed. Submitting a stranger's email resolves —
         correctly — to that stranger's existing customer row, and writing a name
         or a dosha tag from the same request would be an unauthenticated edit of
         somebody else's record. So an existing customer keeps their profile
         exactly as it was; the claim still reaches us, in the lead row, which is
         where an unverified claim belongs.

         A person we have never seen has no history to corrupt, so their name and
         their test result go straight on. */
      if (doshaResultType) {
        await applyDoshaTagsToCustomer(db, { customerId, resultType: doshaResultType });
      }
      if (name) {
        await db.from("customers").update({ display_name: name }).eq("id", customerId);
      }
    }
  } catch {
    // fire-and-forget: the lead itself is already persisted
  }

  await notifyLeadToGroup(lead);

  return cors(NextResponse.json({ ok: true, mode, order_ref: lead.order_ref }));
}
