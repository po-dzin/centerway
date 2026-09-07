#!/usr/bin/env node
/**
 * Refund one WayForPay transaction by our order_ref.
 *
 *   node scripts/wfp-refund.mjs <order_ref>                        # dry run: prints the request, sends nothing
 *   node scripts/wfp-refund.mjs <order_ref> --confirm              # sends the REFUND call
 *   node scripts/wfp-refund.mjs <order_ref> --amount 100 --confirm # partial refund
 *
 * WHY A SCRIPT AND NOT THE MERCHANT PANEL: the first real refund should not be
 * the first time anyone reads WayForPay's REFUND contract. The amount and
 * currency are read from the order row, so a hand-typed sum cannot refund a
 * figure the customer never paid, and an order that is not `paid` is refused
 * before a signature is built.
 *
 * Money moves only with --confirm. This script never writes to the database:
 * the `Refunded` callback reaches /api/wfp/webhook, which already owns the
 * `paid -> refunded` transition. Two writers for one status is how a refunded
 * order ends up looking paid.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const API_URL = "https://api.wayforpay.com/api";

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
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  loadDotEnv();
  const orderRef = process.argv[2];
  if (!orderRef || orderRef.startsWith("--")) {
    console.error("usage: node scripts/wfp-refund.mjs <order_ref> [--amount N] [--comment TEXT] [--confirm]");
    process.exit(2);
  }
  const confirm = process.argv.includes("--confirm");
  const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT;
  const secret = process.env.WFP_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const required = {
    WFP_MERCHANT_ACCOUNT: merchantAccount,
    WFP_SECRET_KEY: secret,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      console.error(`missing env ${key}`);
      process.exit(2);
    }
  }

  const query = `${supabaseUrl}/rest/v1/orders?select=order_ref,product_code,amount,currency,status,created_at&order_ref=eq.${encodeURIComponent(orderRef)}`;
  const res = await fetch(query, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  const rows = await res.json();
  const order = Array.isArray(rows) ? rows[0] : undefined;
  if (!order) {
    console.error(`order ${orderRef} not found`);
    process.exit(1);
  }
  console.log("order:", order);
  if (order.status !== "paid") {
    console.error(`order status is "${order.status}", only "paid" can be refunded`);
    process.exit(1);
  }

  const amount = Number(arg("--amount") ?? order.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(order.amount)) {
    console.error(`refund amount ${amount} must be in (0, ${order.amount}]`);
    process.exit(1);
  }
  const currency = order.currency || "UAH";
  const comment = arg("--comment") ?? "Повернення коштів за запитом";

  // WayForPay REFUND signature: merchantAccount;orderReference;amount;currency,
  // HMAC-MD5 with the merchant secret — the same primitive src/lib/wfp.ts uses
  // for callbacks, different field list.
  const merchantSignature = createHmac("md5", secret)
    .update([merchantAccount, orderRef, String(amount), currency].join(";"), "utf8")
    .digest("hex");

  const body = {
    transactionType: "REFUND",
    merchantAccount,
    orderReference: orderRef,
    amount,
    currency,
    comment,
    apiVersion: 1,
    merchantSignature,
  };
  console.log("request:", { ...body, merchantSignature: `${merchantSignature.slice(0, 8)}…` });

  if (!confirm) {
    console.log("\nDRY RUN — nothing sent. Re-run with --confirm to refund.");
    return;
  }

  const reply = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await reply.text();
  console.log(`wayforpay ${reply.status}:`, text);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Non-JSON reply: the status line above is all there is to report.
  }
  // reasonCode 1100 is WayForPay's "Ok"; Refunded and RefundInProcessing are
  // both success paths, and the webhook decides the final order status.
  if (!reply.ok || (parsed && String(parsed.reasonCode) !== "1100")) process.exit(1);
  console.log("\nRefund accepted. The order flips to `refunded` when the callback lands — check /admin/orders.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
