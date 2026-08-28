/**
 * Applies the support bot's PROFILE — the parts of it a user reads before ever
 * pressing Start, and the shortcuts they get afterwards.
 *
 *   npm run tg:profile          # apply
 *   npm run tg:profile -- --dry # print what would be sent, touch nothing
 *
 * Covers:
 *   setMyName              — the display name
 *   setMyDescription       — the empty-chat screen, before /start
 *   setMyShortDescription  — the bot's profile page
 *   setMyCommands          — the "/" menu
 *   setChatMenuButton      — the blue button beside the input field
 *   setMyProfilePhoto      — the avatar
 *
 * THE AVATAR IS NOT A MANUAL STEP ANY MORE. This script used to say, at
 * length, that Telegram exposes no way to set a bot's own picture and that
 * @BotFather /setuserpic was the only route. That has not been true for a
 * while: setMyProfilePhoto exists and takes an InputProfilePhoto plus an
 * attached file. It was found by asking the live API for it — a 400 "photo
 * isn't specified" where a retired name answers 404. The bot was wearing a
 * stock wellness collage, nothing to do with the mark, precisely because the
 * one step nobody could automate was the one nobody redid.
 *
 * STILL MANUAL, and genuinely so — the PICTURE above the description on the
 * empty-chat screen. Probed alongside the rest: setMyDescriptionPhoto and
 * setMyDescriptionMedia are both 404. BotFather only. The file is baked and
 * its path is printed at the end of a run, so the step at least does not
 * require hunting for it.
 *
 * Texts live in src/lib/tgSupportBotCopy.ts alongside everything else the bot
 * says, so the description and the first reply cannot drift into two voices.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

// TS is imported directly; the npm script supplies --import ./scripts/lib/register-ts.mjs.
import { botProfile } from "../src/lib/tgSupportBotCopy.ts";

const dryRun = process.argv.includes("--dry") || process.argv.includes("--dry-run");
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token && !dryRun) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const AVATAR = path.join(process.cwd(), botProfile.photo);
const DESCRIPTION_PICTURE = path.join(process.cwd(), botProfile.descriptionPicture);

// Telegram's own caps. Exceeded, the API rejects the whole call with a message
// that does not say which field — so they are checked here, where it can.
const LIMITS = { name: 64, description: 512, shortDescription: 120 };

function assertLength(label, value, max) {
  if (value.length > max) {
    console.error(`${label} is ${value.length} chars, limit ${max}`);
    process.exit(1);
  }
}

assertLength("name", botProfile.name, LIMITS.name);
assertLength("description", botProfile.description, LIMITS.description);
assertLength("shortDescription", botProfile.shortDescription, LIMITS.shortDescription);

if (!existsSync(AVATAR)) {
  console.error(`avatar missing: ${AVATAR} — run: npm run brand:build`);
  process.exit(1);
}

async function api(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json().catch(() => ({ ok: false, description: "unparseable response" }));
}

const calls = [
  ["setMyDescription", { description: botProfile.description }],
  ["setMyShortDescription", { short_description: botProfile.shortDescription }],
  ["setMyCommands", { commands: botProfile.commands }],
  ["setChatMenuButton", { menu_button: botProfile.menuButton }],
];

if (dryRun) {
  for (const [method, payload] of calls) {
    console.log(`— ${method}`);
    console.log(JSON.stringify(payload, null, 2));
  }
  console.log(`— setMyName  (only if it differs)\n${JSON.stringify({ name: botProfile.name }, null, 2)}`);
  console.log(`— setMyProfilePhoto  multipart, ${path.relative(process.cwd(), AVATAR)}`);
  console.log("\ndry run — nothing sent.");
} else {
  for (const [method, payload] of calls) {
    const body = await api(method, payload);
    if (!body.ok) {
      console.error(`${method} failed: ${body.description ?? "unknown error"}`);
      process.exit(1);
    }
    console.log(`${method} — ok`);
  }

  /* The name is rate limited far harder than the rest of the profile, and this
     script is meant to be safe to re-run after any copy change. So it is read
     first and only written when it actually differs — re-applying the same
     string is what would eventually spend the budget and fail the whole run on
     a field nobody was editing. */
  const current = await api("getMyName", {});
  if (current.ok && current.result?.name === botProfile.name) {
    console.log("setMyName — skipped (unchanged)");
  } else {
    const body = await api("setMyName", { name: botProfile.name });
    if (!body.ok) {
      console.error(`setMyName failed: ${body.description ?? "unknown error"}`);
      process.exit(1);
    }
    console.log("setMyName — ok");
  }

  /* The one call that is not JSON, and the one with a shape worth writing down.
     `photo` is not the file — it is an InputProfilePhoto object, and the file
     rides beside it under whatever name the object's `attach://` points at.
     Handing the field the image directly, the way sendPhoto takes it, is
     rejected as "photo isn't specified": Telegram is not saying the upload was
     empty, it is saying the field it parses as JSON did not parse. */
  const form = new FormData();
  form.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
  form.append("avatar", new Blob([await readFile(AVATAR)], { type: "image/png" }), path.basename(AVATAR));
  const photoResponse = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
    method: "POST",
    body: form,
  });
  const photoBody = await photoResponse
    .json()
    .catch(() => ({ ok: false, description: "unparseable response" }));
  if (!photoBody.ok) {
    console.error(`setMyProfilePhoto failed: ${photoBody.description ?? "unknown error"}`);
    process.exit(1);
  }
  console.log("setMyProfilePhoto — ok");
}

console.log(
  [
    "",
    "Remaining manual step — the PICTURE on the empty-chat screen, above the",
    "description. The Bot API has no method for it:",
    "  1. open @BotFather → /mybots → this bot → Edit Bot → Edit Description Picture",
    `  2. send ${existsSync(DESCRIPTION_PICTURE) ? DESCRIPTION_PICTURE : `${DESCRIPTION_PICTURE}  (MISSING — run: npm run brand:build)`}`,
    "",
  ].join("\n")
);
