/**
 * Applies the support bot's PROFILE — the parts of it a user reads before ever
 * pressing Start, and the shortcuts they get afterwards.
 *
 *   npm run tg:profile          # apply
 *   npm run tg:profile -- --dry # print what would be sent, touch nothing
 *
 * Covers everything the Bot API is allowed to set:
 *   setMyName              — the display name
 *   setMyDescription       — the empty-chat screen, before /start
 *   setMyShortDescription  — the bot's profile page
 *   setMyCommands          — the "/" menu
 *   setChatMenuButton      — the blue button beside the input field
 *
 * NOT covered, because Telegram does not expose it: the profile PHOTO. There is
 * no setMyPhoto — the avatar can only be set by talking to @BotFather
 * (/setuserpic). The image to send it is baked with the rest of the brand marks
 * and its path is printed at the end of a run, so the one manual step at least
 * does not require hunting for the file.
 *
 * Texts live in src/lib/tgSupportBotCopy.ts alongside everything else the bot
 * says, so the description and the first reply cannot drift into two voices.
 */

import { existsSync } from "node:fs";
import path from "node:path";

// TS is imported directly; the npm script supplies --import ./scripts/lib/register-ts.mjs.
import { botProfile } from "../src/lib/tgSupportBotCopy.ts";

const dryRun = process.argv.includes("--dry") || process.argv.includes("--dry-run");
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token && !dryRun) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const AVATAR = path.join(process.cwd(), "public/cw/brand/cw-icon-512.png");

// Telegram's own caps. Exceeded, the API rejects the whole call with a message
// that does not say which field — so they are checked here, where it can.
const LIMITS = { name: 64, description: 512, shortDescription: 120 };

function assertLength(label, value, max) {
  if (value.length > max) {
    console.error(`${label} is ${value.length} chars, limit ${max}`);
    process.exit(1);
  }
}

assertLength("description", botProfile.description, LIMITS.description);
assertLength("shortDescription", botProfile.shortDescription, LIMITS.shortDescription);

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
  console.log("\ndry run — nothing sent.");
} else {
  for (const [method, payload] of calls) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ ok: false, description: "unparseable response" }));
    if (!body.ok) {
      console.error(`${method} failed: ${body.description ?? response.status}`);
      process.exit(1);
    }
    console.log(`${method} — ok`);
  }
}

console.log(
  [
    "",
    "Remaining manual step — the avatar. The Bot API has no method for it:",
    "  1. open @BotFather → /setuserpic → pick this bot",
    `  2. send ${existsSync(AVATAR) ? AVATAR : `${AVATAR}  (MISSING — run: npm run brand:build)`}`,
    "",
  ].join("\n")
);
