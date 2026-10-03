#!/usr/bin/env node
/**
 * Refund one LiqPay payment by our order_ref.
 *
 *   node scripts/liqpay-refund.mjs <order_ref>                        # dry run: prints the request, sends nothing
 *   node scripts/liqpay-refund.mjs <order_ref> --confirm              # sends the refund call
 *   node scripts/liqpay-refund.mjs <order_ref> --amount 100 --confirm # partial refund
 *
 * The twin of scripts/wfp-refund.mjs, with the same rules: the amount comes
 * from the order row, only a `paid` order is refunded, money moves only with
 * --confirm, and the script never writes to the database — the `reversed`
 * callback reaches /api/liqpay/webhook, which owns `paid -> refunded`.
 *
 * A SPLIT PAYMENT is refunded the same way, by the shop that started it.
 * LiqPay takes the money back from the shops the payment was split to; how it
 * divides a partial refund between them, and what happens when an author's
 * balance is short, is one of the questions to LiqPay support (research doc
 * §7.1a). Authors do not refund platform orders from their own dashboards.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const API_URL = "https://www.liqpay.ua/api/request";
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
    console.error("usage: node scripts/liqpay-refund.mjs <order_ref> [--amount N] [--confirm]");
    process.exit(2);
  }
  const confirm = process.argv.includes("--confirm");
  const publicKey = process.env.LIQPAY_PUBLIC_KEY;
  const privateKey = process.env.LIQPAY_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const required = {
    LIQPAY_PUBLIC_KEY: publicKey,
    LIQPAY_PRIVATE_KEY: privateKey,
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
  // Same envelope as every LiqPay call: base64 JSON `data`, and
  // base64(sha1(private_key + data + private_key)) — src/lib/payments/gateway/liqpay.ts.
  const params = { version: 3, public_key: publicKey, action: "refund", order_id: orderRef, amount };
  const data = Buffer.from(JSON.stringify(params), "utf8").toString("base64");
  const signature = createHash("sha1")
    .update(privateKey + data + privateKey, "utf8")
    .digest("base64");
  console.log("request:", params);

  if (!confirm) {
    console.log("\nDRY RUN — nothing sent. Re-run with --confirm to refund.");
    return;
  }

  const reply = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data, signature }).toString(),
  });
  const text = await reply.text();
  console.log(`liqpay ${reply.status}:`, text);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Non-JSON reply: the status line above is all there is to report.
  }
  // `result: "ok"` is acceptance; the webhook decides the final order status.
  if (!reply.ok || parsed?.result !== "ok") process.exit(1);
  console.log("\nRefund accepted. The order flips to `refunded` when the callback lands — check /admin/orders.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
