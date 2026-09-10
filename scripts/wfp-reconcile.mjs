#!/usr/bin/env node
/**
 * Ask WayForPay what it thinks happened, and repair every order we missed.
 *
 *   node scripts/wfp-reconcile.mjs                     # dry run: lists the gap, sends nothing
 *   node scripts/wfp-reconcile.mjs --confirm           # replays the missing callbacks
 *   node scripts/wfp-reconcile.mjs --order <ref> --confirm
 *   node scripts/wfp-reconcile.mjs --days 60           # default 30, WayForPay caps a window at 31
 *
 * WHY THIS EXISTS
 *
 * On 2026-09-10 a customer paid 2900 UAH and got nothing. The code was fine:
 * `APP_BASE_URL` in production still named `centerway.vercel.app`, an alias that
 * had stopped resolving, so every invoice went out carrying
 * `serviceUrl = https://centerway.vercel.app/api/wfp/webhook`. WayForPay
 * delivered the approval to a 404 for four days and gave up. Our database said
 * `created`, the operator's Telegram stayed silent, and the only signal that a
 * sale had happened at all was the buyer writing to support.
 *
 * The lesson is not "check the env var". It is that the gateway held the truth
 * the whole time and nothing on our side ever asked it. This script asks.
 *
 * HOW IT REPAIRS
 *
 * Not by writing `paid` into a row. `CHECK_STATUS` returns the same eight
 * signed fields a service callback carries — merchantAccount, orderReference,
 * amount, currency, authCode, cardPan, transactionStatus, reasonCode — under
 * the same HMAC-MD5 with the same merchant secret. So the gateway's own record
 * IS a valid callback, and replaying it into `/api/wfp/webhook` runs the real
 * fulfilment path exactly once: payments row, orders.status, customer, event,
 * the Meta Purchase, the buyer's receipt, the operator's Telegram report.
 *
 * Hand-patching `orders.status` would produce a paid order with no payment, no
 * receipt and no report — which is the same hole this script exists to close,
 * dug from the other side.
 *
 * The webhook is idempotent, so replaying an order that already went through is
 * harmless; it is skipped anyway, because a second Telegram report for a sale
 * the operator already saw is noise, and noise is how a real alert gets ignored.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

/* The one field list, imported: this script runs under scripts/lib/register-ts.mjs
   (see the npm script), so it reads the same source the webhook verifies with.
   The copy that lived here said a smoke test kept the two in step; no such test
   existed. */
import { WFP_CALLBACK_SIGNATURE_FIELDS as CALLBACK_SIGNATURE_FIELDS } from "@/lib/payments/wfp";

const WFP_API = "https://api.wayforpay.com/api";

function loadDotEnv(path = ".env.local") {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — the caller is expected to have exported the vars.
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function sign(secret, fields) {
  return createHmac("md5", secret).update(fields.join(";"), "utf8").digest("hex");
}

async function wfp(body) {
  const res = await fetch(WFP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Every transaction the gateway saw, in windows it will accept (31 days max). */
async function listTransactions(merchantAccount, secret, days) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 24 * 3600;
  const WINDOW = 30 * DAY;
  const out = [];
  for (let start = now - days * DAY; start < now; start += WINDOW) {
    const dateBegin = start;
    const dateEnd = Math.min(start + WINDOW, now);
    const j = await wfp({
      apiVersion: 1,
      transactionType: "TRANSACTION_LIST",
      merchantAccount,
      merchantSignature: sign(secret, [merchantAccount, dateBegin, dateEnd]),
      dateBegin,
      dateEnd,
    });
    if (j.reason !== "Ok") throw new Error(`TRANSACTION_LIST: ${j.reason}`);
    out.push(...(j.transactionList ?? []));
  }
  return out;
}

async function checkStatus(merchantAccount, secret, orderReference) {
  const j = await wfp({
    apiVersion: 1,
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature: sign(secret, [merchantAccount, orderReference]),
  });
  if (j.reason !== "Ok") throw new Error(`CHECK_STATUS ${orderReference}: ${j.reason}`);
  return j;
}

/**
 * Turn the gateway's record into the callback body it would have sent.
 *
 * `amount` is stringified deliberately: the signature is computed over string
 * joins, and `2900` and `2900.00` are different strings for the same money.
 * CHECK_STATUS returns the number, which is what a live callback carries too.
 *
 * `email` and `phone` ride along outside the signed eight. The webhook reads
 * them for the customer row, the receipt and the Purchase event, and CHECK_STATUS
 * does not return them — so they come from the transaction list, which does.
 */
function callbackFromStatus(status, contact) {
  const payload = {};
  for (const field of CALLBACK_SIGNATURE_FIELDS) {
    payload[field] = status[field] ?? "";
  }
  payload.merchantSignature = status.merchantSignature;
  payload.processingDate = status.processingDate ?? status.createdDate ?? null;
  payload.createdDate = status.createdDate ?? null;
  if (contact?.email) payload.email = contact.email;
  if (contact?.phone) payload.phone = contact.phone;
  return payload;
}

async function main() {
  loadDotEnv();
  const confirm = process.argv.includes("--confirm");
  const onlyOrder = arg("order");
  const days = Number(arg("days") ?? 30);

  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT;
  const secret = process.env.WFP_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  /* The webhook is addressed by its canonical public host and NOT by
     APP_BASE_URL. Reusing that variable would make this script trust the one
     value whose drift it exists to catch. */
  const webhookBase = arg("webhook") ?? "https://www.centerway.net.ua";

  for (const [key, value] of Object.entries({
    WFP_MERCHANT_ACCOUNT: merchantAccount,
    WFP_SECRET_KEY: secret,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  })) {
    if (!value) {
      console.error(`missing env ${key}`);
      process.exit(2);
    }
  }

  const transactions = await listTransactions(merchantAccount, secret, days);
  const approved = new Map();
  for (const t of transactions) {
    if (t.transactionStatus !== "Approved") continue;
    if (onlyOrder && t.orderReference !== onlyOrder) continue;
    approved.set(t.orderReference, { email: t.email || null, phone: t.phone || null });
  }

  if (approved.size === 0) {
    console.log(`no approved WayForPay transactions in the last ${days} days`);
    return;
  }

  const refs = [...approved.keys()];
  const query =
    `${supabaseUrl}/rest/v1/orders?select=order_ref,product_code,amount,currency,status` +
    `&order_ref=in.(${refs.map((r) => `"${r}"`).join(",")})`;
  const res = await fetch(query, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const orders = await res.json();
  const held = new Map((Array.isArray(orders) ? orders : []).map((o) => [o.order_ref, o]));

  /* The gap: money the gateway approved that our own records do not call paid.
     An order the gateway approved and we never even created is reported too —
     it means the invoice was raised somewhere we are not looking, and silence
     about that would be worse than a noisy line. */
  const gap = refs.filter((ref) => (held.get(ref)?.status ?? null) !== "paid");

  console.log(`approved at WayForPay: ${refs.length}`);
  console.log(`not paid in our database: ${gap.length}`);
  if (gap.length === 0) return;

  for (const ref of gap) {
    const order = held.get(ref);
    console.log(`  ${ref}  ours=${order?.status ?? "MISSING ORDER ROW"}  ${order?.amount ?? "?"} ${order?.currency ?? ""}  ${approved.get(ref).email ?? "no email"}`);
  }

  if (!confirm) {
    console.log("\ndry run — rerun with --confirm to replay these callbacks");
    return;
  }

  for (const ref of gap) {
    const status = await checkStatus(merchantAccount, secret, ref);
    if (status.transactionStatus !== "Approved") {
      console.log(`  ${ref}: gateway now says ${status.transactionStatus}, skipped`);
      continue;
    }
    const body = callbackFromStatus(status, approved.get(ref));
    const res = await fetch(`${webhookBase}/api/wfp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`  ${ref}: ${res.status} ${text.slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
