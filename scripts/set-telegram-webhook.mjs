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

const webhookUrl =
  explicitUrl ||
  (appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, "")}/api/tg/support-bot`
    : null);

if (!webhookUrl) {
  console.error("Missing TELEGRAM_WEBHOOK_URL or APP_BASE_URL");
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
