import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_DELIVERY, PRODUCT_LABELS, assertProduct, normalizeEmail, normalizePhoneDigits } from "./tgSupportBot";
import { botCopy, botProfile, CABINET_URL, GREETING_PHOTO_URL } from "./tgSupportBotCopy";

describe("support bot — product routing", () => {
  it("has a delivery target and a label for every product it offers", () => {
    // The picker is generated from PRODUCT_LABELS and the answer is looked up in
    // PRODUCT_DELIVERY. A product present in one and missing from the other is a
    // button that leads nowhere.
    expect(Object.keys(PRODUCT_DELIVERY).sort()).toEqual(Object.keys(PRODUCT_LABELS).sort());
  });

  it("routes every course to the cabinet", () => {
    // The correction this rewrite exists for: way21 and reset-day run on the
    // platform, and the old copy told their buyers to look inside a product bot.
    expect(PRODUCT_DELIVERY.way21).toEqual({ kind: "platform", courseSlug: "way21" });
    expect(PRODUCT_DELIVERY["reset-day"]).toEqual({ kind: "platform", courseSlug: "reset-day" });
    // Short and IREM left their own bots on 2026-08-29 — the courseSlug is the
    // ROW, and IREM's row is not the name it is sold under.
    expect(PRODUCT_DELIVERY.short).toEqual({ kind: "platform", courseSlug: "short" });
    expect(PRODUCT_DELIVERY.irem).toEqual({ kind: "platform", courseSlug: "irem-gymnastics" });
  });

  it("accepts every alias the funnels and thanks pages actually send", () => {
    expect(assertProduct("reboot")).toBe("short");
    expect(assertProduct("shlyah21")).toBe("way21");
    expect(assertProduct("detox21")).toBe("way21");
    expect(assertProduct("reset_day")).toBe("reset-day");
    expect(assertProduct("rozvantazhennya")).toBe("reset-day");
    expect(assertProduct("nonsense")).toBeNull();
    expect(assertProduct(null)).toBeNull();
  });

  it("keeps the products it accepts inside the database's CHECK constraint", () => {
    // docs/migration/sql/2026-08-21_support_bot_products.sql. Writing a product
    // outside this set raises 23514 inside saveSession, which the webhook
    // swallows — the button does nothing, silently. That is the bug this list
    // exists to stop recurring.
    const allowedByConstraint = ["short", "irem", "way21", "reset-day"];
    expect(Object.keys(PRODUCT_LABELS).sort()).toEqual([...allowedByConstraint].sort());
  });
});

describe("support bot — copy", () => {
  it("has an answer for every FAQ button", () => {
    // Keyboard and answers are both derived from botCopy, so this asserts the
    // derivation still holds rather than a hand-kept pair.
    expect(Object.keys(botCopy.faqLabels).sort()).toEqual(Object.keys(botCopy.faq).sort());
  });

  it("sends people to the cabinet with an absolute URL", () => {
    // A relative path is printed, not linkified, by Telegram.
    expect(CABINET_URL).toMatch(/^https:\/\//);
    expect(botCopy.cabinet).toContain(CABINET_URL);
    expect(botCopy.faq.where_course).toContain(CABINET_URL);
  });

  it("addresses the reader as «ви» throughout", () => {
    // One conversation, one register: reminders arrive in this same chat from
    // this same token, so a «ти» here would be the third voice in it.
    const informal = /\b(увійди|напиши|перевір|відкрий|натисни|спробуй|твій|твоя|твоє|твоїм|тобі)\b/i;
    const strings = collectStrings(botCopy);
    expect(strings.length).toBeGreaterThan(15);
    for (const line of strings) {
      expect(line, line).not.toMatch(informal);
    }
  });

  it("keeps the bot profile inside Telegram's own limits", () => {
    // Over the limit, the API rejects the whole call with a message that does
    // not name the field.
    expect(botProfile.name.length).toBeLessThanOrEqual(64);
    expect(botProfile.description.length).toBeLessThanOrEqual(512);
    expect(botProfile.shortDescription.length).toBeLessThanOrEqual(120);
    for (const command of botProfile.commands) {
      expect(command.command).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(command.description.length).toBeLessThanOrEqual(256);
    }
  });

  it("ships the images the profile promises", () => {
    // Both are bake output (scripts/brand-mark-bake.mjs). Renaming an emit and
    // leaving the path here is a `npm run tg:profile` that dies on the last
    // call, after four fields are already live — so the mismatch is caught in
    // the suite instead of halfway through a profile update.
    for (const asset of [botProfile.photo, botProfile.descriptionPicture]) {
      expect(existsSync(path.join(process.cwd(), asset)), asset).toBe(true);
    }
  });

  it("keeps the greeting short enough to ride as a photo caption", () => {
    // /start answers with the brand card captioned by the greeting, and
    // Telegram caps a caption at 1024 — well under the 4096 a plain message
    // gets. Copy grown past it would fail the send, not truncate.
    expect(botCopy.greeting.length).toBeLessThanOrEqual(1024);
    expect(GREETING_PHOTO_URL).toMatch(/^https:\/\/.+\.png$/);
  });

  it("registers a command for every menu branch a command claims to open", () => {
    // /courses, /access, /help and /support are shortcuts into menu actions.
    // A registered command with no branch answers with the fallback.
    const handled = new Set(["start", "courses", "access", "help", "support"]);
    for (const command of botProfile.commands) {
      expect(handled.has(command.command), command.command).toBe(true);
    }
  });
});

describe("support bot — contact normalisation", () => {
  it("normalises Ukrainian phone shapes to one lookup form", () => {
    expect(normalizePhoneDigits("+38 (063) 602 44 50")).toBe("380636024450");
    expect(normalizePhoneDigits("0636024450")).toBe("380636024450");
    expect(normalizePhoneDigits("636024450")).toBe("380636024450");
    expect(normalizePhoneDigits("123")).toBeNull();
  });

  it("lowercases an email and rejects a non-email", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("not an email")).toBeNull();
  });
});

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "function") return out;
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectStrings(item, out);
  }
  return out;
}
