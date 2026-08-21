/**
 * Tells you why the bot is quiet.
 *
 *   npm run tg:doctor
 *
 * Every Telegram path in this codebase fails SOFTLY on purpose — the webhook
 * answers `{ ok: true, handled: false }` rather than 500 so Telegram stops
 * retrying, group notifications are wrapped in `catch {}` so a Telegram outage
 * cannot break a lead form, and every one of them is gated on an env var that
 * simply returns early when unset. Correct behaviour, all of it, and the sum is
 * a system that can be fully switched off without a single error anywhere.
 *
 * This is the one place that asks out loud. Read-only: it calls getMe,
 * getWebhookInfo and getChat, and sends no messages.
 */

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

async function api(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  return response.json().catch(() => ({ ok: false, description: "unparseable response" }));
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const supportChatId = process.env.SUPPORT_CHAT_ID;
const supportThreadId = process.env.SUPPORT_THREAD_ID;
const leadsThreadId = process.env.LEADS_THREAD_ID;

record("TELEGRAM_BOT_TOKEN", Boolean(token), token ? "set" : "unset — the bot cannot send or receive anything");
record(
  "TELEGRAM_WEBHOOK_SECRET",
  Boolean(webhookSecret),
  webhookSecret ? "set" : "unset — /api/tg/support-bot answers 500 to every update"
);
record(
  "SUPPORT_CHAT_ID",
  Boolean(supportChatId),
  supportChatId
    ? `set (${supportChatId})`
    : "unset — support requests, landing leads and SendPulse write-ins all return early, silently"
);
record("SUPPORT_THREAD_ID", true, supportThreadId ? `set (${supportThreadId})` : "unset — posts to the group's General topic");
record(
  "LEADS_THREAD_ID",
  true,
  leadsThreadId ? `set (${leadsThreadId})` : `unset — landing leads fall back to SUPPORT_THREAD_ID`
);

if (token) {
  const me = await api(token, "getMe");
  record("getMe", Boolean(me.ok), me.ok ? `@${me.result.username} (${me.result.first_name})` : me.description);

  const hook = await api(token, "getWebhookInfo");
  if (!hook.ok) {
    record("getWebhookInfo", false, hook.description);
  } else {
    const info = hook.result;
    record("webhook url", Boolean(info.url), info.url || "not set — run: npm run tg:webhook:set");
    // The one field that actually explains a bot that "does nothing": Telegram
    // keeps reporting the last delivery error long after it stopped happening.
    record(
      "webhook last error",
      !info.last_error_message,
      info.last_error_message
        ? `${info.last_error_message} (${new Date((info.last_error_date ?? 0) * 1000).toISOString()})`
        : "none"
    );
    record("pending updates", info.pending_update_count === 0, String(info.pending_update_count ?? 0));
  }

  if (supportChatId) {
    const chat = await api(token, "getChat", { chat_id: supportChatId });
    record(
      "support chat reachable",
      Boolean(chat.ok),
      chat.ok
        ? `${chat.result.title ?? chat.result.type} — the bot is a member`
        : `${chat.description} — the bot is probably not in the group, or the id is wrong`
    );
  }
}

const width = Math.max(...checks.map((c) => c.name.length));
let failed = 0;

for (const check of checks) {
  if (!check.ok) failed += 1;
  console.log(`${check.ok ? "ok  " : "FAIL"}  ${check.name.padEnd(width)}  ${check.detail}`);
}

console.log("");
console.log(failed === 0 ? "Telegram channel looks configured." : `${failed} problem(s) above.`);
process.exit(failed === 0 ? 0 : 1);
