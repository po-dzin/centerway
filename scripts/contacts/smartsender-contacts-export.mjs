#!/usr/bin/env node
/**
 * Export contacts from Smart Sender, with the messenger ids its CSV export leaves out.
 *
 * Status: a PROBE first, an exporter second. Smart Sender's API reference is
 * rendered client-side and could not be read ahead of time. So this script
 * tries the listing shapes the API is known to use, prints only the field
 * names and counts it finds, and writes whatever it managed to page through to
 * the gitignored raw folder. Evidence Smart Sender does hold the Telegram id:
 * its flows filled `{{tgUserId}}` in the May 2026 IREM links
 * (docs/archive/working-notes/irem-personal-offer-tokens-2026-05-18.md).
 *
 *   node scripts/contacts/smartsender-contacts-export.mjs
 *
 * Needs `SMARTSENDER_API_TOKEN` in .env.local. It is a project API token
 * (Smart Sender → Settings → API), sent as a Bearer token.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

import { loadDotEnv } from "../lib/db-url.mjs";

loadDotEnv();
const token = process.env.SMARTSENDER_API_TOKEN;
if (!token) {
  console.error("Put SMARTSENDER_API_TOKEN in .env.local");
  process.exit(2);
}

const API = "https://api.smartsender.com/v1";

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body };
}

const list = (body) =>
  Array.isArray(body)
    ? body
    : Array.isArray(body?.collection)
      ? body.collection
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.items)
          ? body.items
          : [];

const keysDeep = (obj, prefix = "", depth = 0) =>
  !obj || typeof obj !== "object" || depth > 2
    ? []
    : Object.entries(obj).flatMap(([k, v]) => [
        `${prefix}${k}`,
        ...(v && typeof v === "object" && !Array.isArray(v) ? keysDeep(v, `${prefix}${k}.`, depth + 1) : []),
      ]);

const ID_LIKE = /(^|\.)(id|userid|user_id|tguserid|telegram_?id|chat_?id|external_?id|messenger_?id|username)$/i;

// Listing shapes to try, most likely first. The first one that answers 200 with
// a list is paged through; the rest are only reported.
// `limitation` is Smart Sender's page size; 100 answers "Maximum available
// limitation reached". 20 is a safe size, found by trial, not from the docs.
const PAGE_SIZE = 20;
const CANDIDATES = [(page) => `/contacts?page=${page}&limitation=${PAGE_SIZE}`];

const DIR = "data/contacts-import/raw";
const today = `${DIR}/smartsender-contacts-${new Date().toISOString().slice(0, 10)}.json`;
/* Resume the LATEST export, not today's. A sweep started yesterday and
   continued today would otherwise silently re-list 1941 contacts and re-fetch
   every gate — hours of rate-limited calls to rebuild what is already on disk. */
const previous = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => /^smartsender-contacts-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .at(-1)
  : undefined;
const resume = process.argv.includes("--resume") && Boolean(previous);
const file = resume ? `${DIR}/${previous}` : today;
const result = resume
  ? JSON.parse(readFileSync(file, "utf8"))
  : { exported_at: new Date().toISOString(), source: "smartsender", endpoint: null, contacts: [] };
if (resume) console.log(`resuming ${file}: ${result.contacts.length} contacts`);

for (const build of resume ? [] : CANDIDATES) {
  const probe = await get(build(1));
  const items = list(probe.body);
  const shape = build(1).split("?")[0];
  console.log(`${shape} → ${probe.status}, items on page 1: ${items.length}`);
  if (probe.status !== 200 || items.length === 0) {
    if (probe.status !== 200) console.log("  body:", JSON.stringify(probe.body).slice(0, 200));
    continue;
  }

  const fields = keysDeep(items[0]);
  console.log("  fields:", fields.join(", "));
  console.log("  id-like:", fields.filter((k) => ID_LIKE.test(k)).join(", ") || "none");
  if (probe.body && !Array.isArray(probe.body)) {
    console.log("  envelope:", Object.keys(probe.body).join(", "));
  }

  result.endpoint = shape;
  result.contacts.push(...items);
  for (let page = 2; page < 500; page++) {
    const next = list((await get(build(page))).body);
    const fresh = next.filter((c) => !result.contacts.some((known) => known.id === c.id));
    result.contacts.push(...fresh);
    if (next.length === 0 || fresh.length === 0) break;
  }
  console.log(`  paged: ${result.contacts.length} contacts`);
  break;
}

if (!result.endpoint) {
  console.log("No listing endpoint answered. Nothing written.");
  process.exit(1);
}

/* The messenger side of a contact is not on the contact: it is in its GATES —
   one per channel the person reached the project through, each with the channel
   (bot name, type) and a numeric id. Fetched per contact, ONE at a time.

   Smart Sender rate-limits hard: past its budget every call answers
   `423 Too many requests. Please, try again in 120 seconds`. Four in parallel
   lost 1680 of 1941 contacts to it on the first run. So: sequential, a short
   pause between calls, a full wait on 423, progress saved as it goes, and
   `--resume` picks up only the contacts that still have no gates. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => {
  mkdirSync("data/contacts-import/raw", { recursive: true });
  writeFileSync(file, JSON.stringify(result, null, 2));
};
const todo = result.contacts.filter((c) => !Array.isArray(c.gates) && c.gates_error !== 404);
console.log(`gates to fetch: ${todo.length}`);
let failed = 0;
let done = 0;
for (const contact of todo) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await get(`/contacts/${contact.id}/gates?page=1&limitation=20`);
    if (res.status === 200) {
      contact.gates = list(res.body);
      delete contact.gates_error;
      break;
    }
    if (res.status === 423 || res.status === 429 || res.status >= 500) {
      console.log(`  ${res.status} after ${done} — waiting 125 s`);
      save();
      await sleep(125_000);
      continue;
    }
    contact.gates_error = res.status;
    failed++;
    break;
  }
  done++;
  if (done % 100 === 0) {
    console.log(`  ${done}/${todo.length}`);
    save();
  }
  await sleep(250);
}

/* WHO TOOK WHICH PROGRAM. Smart Sender has no "students of this training"
   endpoint — `/trainings/{id}/contacts` is a 404 — so the only way to the roster
   is to ask every contact what it is enrolled in. Same pacing as the gates pass,
   and `--trainings` keeps it opt-in because it is another full sweep. */
if (process.argv.includes("--trainings")) {
  const catalogue = list((await get("/trainings?page=1&limitation=20")).body);
  console.log("trainings:", catalogue.map((t) => `${t.id}:${t.name}`).join(" | "));

  const pending = result.contacts.filter((c) => !Array.isArray(c.trainings));
  console.log(`trainings to fetch: ${pending.length}`);
  let n = 0;
  for (const contact of pending) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      const res = await get(`/contacts/${contact.id}/trainings?page=1&limitation=20`);
      if (res.status === 200) {
        contact.trainings = list(res.body).map((t) => ({ id: t.id, name: t.name }));
        break;
      }
      if (res.status === 423 || res.status === 429 || res.status >= 500) {
        console.log(`  ${res.status} after ${n} — waiting 125 s`);
        save();
        await sleep(125_000);
        continue;
      }
      contact.trainings_error = res.status;
      break;
    }
    n++;
    if (n % 100 === 0) {
      console.log(`  ${n}/${pending.length}`);
      save();
    }
    await sleep(250);
  }

  const roster = {};
  for (const contact of result.contacts) {
    for (const training of contact.trainings ?? []) {
      roster[`${training.id}:${training.name}`] = (roster[`${training.id}:${training.name}`] ?? 0) + 1;
    }
  }
  console.log("by training:", roster);
}

const channels = {};
for (const contact of result.contacts) {
  for (const gate of contact.gates ?? []) {
    const key = `${gate.channel?.type}:${gate.channel?.name}`;
    channels[key] ??= { gates: 0, subscribed: 0 };
    channels[key].gates++;
    if (gate.subscribed) channels[key].subscribed++;
  }
}
const withoutGates = result.contacts.filter((c) => !Array.isArray(c.gates)).length;
console.log(`gates fetched; failed for ${failed} contacts; still without gates: ${withoutGates}`);
console.log("by channel:", channels);

save();
console.log(`→ ${file}`);
