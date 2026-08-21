/**
 * Points the support bot's webhook at the platform.
 *
 * The default is PLATFORM_ORIGIN — the canonical host, declared once in the
 * surface registry — and NOT `APP_BASE_URL`. That variable is a deploy-time
 * setting whose local value is `http://localhost:3000`, so running this script
 * on a developer machine used to aim the LIVE bot's webhook at localhost.
 * Telegram rejects a non-HTTPS URL, so it failed loudly rather than silently,
 * but the failure was a cryptic API error about a chore nobody meant to do.
 *
 * The apex is deliberately not usable here even though it resolves: it 308s to
 * www, and Telegram does not follow redirects when delivering updates.
 *
 * Overrides, in order: TELEGRAM_WEBHOOK_URL (a whole URL), then APP_BASE_URL.
 */

import { PLATFORM_ORIGIN } from "../src/lib/surfaces/catalog.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
const explicitUrl = process.env.TELEGRAM_WEBHOOK_URL;
const appBaseUrl = process.env.APP_BASE_URL;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

if (!secretToken) {
  console.error("Missing TELEGRAM_WEBHOOK_SECRET");
  process.exit(1);
}

const base = explicitUrl ? null : (appBaseUrl || PLATFORM_ORIGIN);
const webhookUrl = explicitUrl || `${base.replace(/\/$/, "")}/api/tg/support-bot`;

if (!webhookUrl.startsWith("https://")) {
  console.error(`Refusing to set a non-HTTPS webhook: ${webhookUrl}`);
  console.error("Telegram requires HTTPS. Unset APP_BASE_URL to use the platform origin, or set TELEGRAM_WEBHOOK_URL.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  }),
});

const body = await response.json().catch(async () => ({
  ok: false,
  description: await response.text().catch(() => "Unknown response"),
}));

if (!response.ok || !body.ok) {
  console.error("Telegram setWebhook failed", {
    status: response.status,
    description: body.description,
  });
  process.exit(1);
}

console.log("Telegram webhook configured", { url: webhookUrl });
