#!/usr/bin/env node
/**
 * Export Telegram chatbot contacts from SendPulse, before the bots move to the
 * platform.
 *
 * WHY THE API AND NOT THE UI EXPORT. The CSV export in SendPulse leaves out the
 * Telegram user id, and without it nobody can be written to again. The API's
 * `/telegram/contacts` carries `telegram_id` on every contact. For a private chat
 * that id IS the chat id, and it stays valid once the same bot token is served by
 * our webhook.
 *
 *   node scripts/contacts/sendpulse-telegram-export.mjs
 *
 * Needs `SENDPULSE_API_KEY` (an `sp_apikey_…` key, sent as a Bearer token) or
 * `SENDPULSE_API_ID` + `SENDPULSE_API_SECRET` in .env.local.
 *
 * Writes `data/contacts-import/raw/sendpulse-telegram-<date>.json`. That folder is
 * gitignored because the contacts are personal data. The console shows counts
 * only.
 *
 * A bot that SendPulse reports as not active refuses contact reads
 * ("Bot is not active"). Switch it on in SendPulse for the export.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { loadDotEnv } from "../lib/db-url.mjs";

loadDotEnv();
const { SENDPULSE_API_KEY: apiKey, SENDPULSE_API_ID: id, SENDPULSE_API_SECRET: secret } = process.env;
if (!apiKey && !(id && secret)) {
  console.error("Put SENDPULSE_API_KEY (or SENDPULSE_API_ID + SENDPULSE_API_SECRET) in .env.local");
  process.exit(2);
}

const API = "https://api.sendpulse.com";
let token = apiKey;
if (!token) {
  const res = await fetch(`${API}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) {
    console.error("token failed:", res.status);
    process.exit(1);
  }
  ({ access_token: token } = await res.json());
}

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const list = (body) => (Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []);

const bots = await get("/telegram/bots");
if (bots.status !== 200) {
  console.error("GET /telegram/bots →", bots.status);
  process.exit(1);
}

const PAGE = 100;
const result = { exported_at: new Date().toISOString(), source: "sendpulse", bots: [] };

for (const bot of list(bots.body)) {
  const entry = {
    id: bot.id,
    name: bot.channel_data?.name ?? null,
    username: bot.channel_data?.username ?? null,
    status: bot.status,
    contacts: [],
    error: null,
  };
  for (let offset = 0; ; offset += PAGE) {
    const res = await get(`/telegram/contacts?bot_id=${bot.id}&limit=${PAGE}&offset=${offset}`);
    if (res.status !== 200) {
      entry.error = res.body?.errors ?? res.body?.message ?? String(res.status);
      break;
    }
    const page = list(res.body);
    // Some API versions ignore `offset`; stop on a repeated page rather than loop.
    const fresh = page.filter((c) => !entry.contacts.some((known) => known.id === c.id));
    entry.contacts.push(...fresh);
    if (page.length < PAGE || fresh.length === 0) break;
  }
  result.bots.push(entry);

  const withId = entry.contacts.filter((c) => c.telegram_id).length;
  const unsubscribed = entry.contacts.filter((c) => c.unsubscribed_at).length;
  console.log(
    `${entry.name ?? entry.id}: ${entry.contacts.length} contacts, ${withId} with telegram_id, ${unsubscribed} unsubscribed` +
      (entry.error ? ` — error: ${JSON.stringify(entry.error)}` : ""),
  );
}

mkdirSync("data/contacts-import/raw", { recursive: true });
const file = `data/contacts-import/raw/sendpulse-telegram-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(result, null, 2));
console.log(`→ ${file}`);
