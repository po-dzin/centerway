import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyResendWebhook, parseResendEvent } from "@/lib/email/resendWebhook";

import { normalizeAudience } from "./audience";
import { mapStatus, parseContacts, parseCsv } from "./csv";
import { parseBlocks, personalize, renderBroadcastEmail } from "./render";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribeToken";

describe("unsubscribe token", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.BROADCAST_LINK_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("round-trips an address and a campaign, normalized", () => {
    const token = createUnsubscribeToken("  Anna@Example.COM ", "11111111-2222-3333-4444-555555555555");
    expect(verifyUnsubscribeToken(token)).toEqual({
      ok: true,
      address: "anna@example.com",
      broadcastId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("works without a campaign", () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken("a@b.co"))).toEqual({
      ok: true,
      address: "a@b.co",
      broadcastId: null,
    });
  });

  it("refuses a token whose address was swapped", () => {
    const token = createUnsubscribeToken("a@b.co");
    const [v, , c, sig] = token.split(".");
    const forged = [v, Buffer.from("victim@b.co").toString("base64url"), c, sig].join(".");
    expect(verifyUnsubscribeToken(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a token signed with another secret", () => {
    const token = createUnsubscribeToken("a@b.co");
    process.env.BROADCAST_LINK_SECRET = "rotated";
    expect(verifyUnsubscribeToken(token).ok).toBe(false);
  });

  it("refuses garbage", () => {
    expect(verifyUnsubscribeToken(null).ok).toBe(false);
    expect(verifyUnsubscribeToken("u1.a.b").ok).toBe(false);
    expect(verifyUnsubscribeToken("x".repeat(40)).ok).toBe(false);
  });
});

describe("render", () => {
  it("fills the name with the first word, or the fallback", () => {
    expect(personalize("Вітаю, {{name}}!", "Анна Коваль")).toBe("Вітаю, Анна!");
    expect(personalize("Вітаю, {{ name | друзі }}!", null)).toBe("Вітаю, друзі!");
    expect(personalize("Вітаю, {{name}}!", "")).toBe("Вітаю, !");
  });

  it("parses headings, lists and paragraphs", () => {
    expect(parseBlocks("# Тема\nрядок 1\nрядок 2\n\n- один\n- два")).toEqual([
      { kind: "heading", text: "Тема" },
      { kind: "paragraph", lines: ["рядок 1", "рядок 2"] },
      { kind: "list", items: ["один", "два"] },
    ]);
  });

  it("escapes HTML and refuses javascript links", () => {
    const { html, text } = renderBroadcastEmail(
      { subject: "S", body: '<script>x</script> [клік](javascript:alert(1)) [сайт](https://cw.ua/a?b=1&c=2) **ж**' },
      { unsubscribeUrl: "https://cw.ua/unsubscribe?t=1" },
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="https://cw.ua/a?b=1&amp;c=2"');
    expect(html).toContain("<strong>ж</strong>");
    expect(text).toContain("сайт (https://cw.ua/a?b=1&c=2)");
  });

  it("always carries the unsubscribe link in both parts", () => {
    const { html, text } = renderBroadcastEmail({ subject: "S", body: "B" }, { unsubscribeUrl: "https://x/u?t=9" });
    expect(html).toContain('href="https://x/u?t=9"');
    expect(text).toContain("https://x/u?t=9");
  });

  it("drops a button whose link is unsafe", () => {
    const { html } = renderBroadcastEmail(
      { subject: "S", body: "B", ctaLabel: "Go", ctaUrl: "javascript:1" },
      { unsubscribeUrl: "#" },
    );
    expect(html).not.toContain(">Go<");
  });
});

describe("csv import", () => {
  it("reads a semicolon export with quotes, BOM and a status column", () => {
    const csv = '﻿Email;Ім\'я;Статус\n"anna@x.com";"Анна; ""А""";active\nBAD;x;active\nbob@x.com;;Відписаний\nANNA@x.com;;unsubscribed\n';
    const parsed = parseContacts(csv);
    expect(parsed.invalid).toBe(1);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.rows).toEqual([
      { email: "anna@x.com", name: 'Анна; "А"', status: "unsubscribed" },
      { email: "bob@x.com", name: null, status: "unsubscribed" },
    ]);
  });

  it("finds the address in a file with no header", () => {
    expect(parseContacts("a@x.com,Ann\nb@x.com,Bob").rows.map((r) => r.email)).toEqual(["a@x.com", "b@x.com"]);
  });

  it("keeps newlines inside quotes in one field", () => {
    expect(parseCsv('a,"b\nc"\nd,e')).toEqual([
      ["a", "b\nc"],
      ["d", "e"],
    ]);
  });

  it("maps statuses conservatively", () => {
    expect(mapStatus("Unsubscribed")).toBe("unsubscribed");
    expect(mapStatus("отписан")).toBe("unsubscribed");
    expect(mapStatus("hard bounce")).toBe("bounced");
    expect(mapStatus("active")).toBe("subscribed");
    expect(mapStatus(undefined)).toBe("subscribed");
  });
});

describe("audience", () => {
  it("drops unknown kinds, empty tag rules, bad course ids and duplicates", () => {
    expect(
      normalizeAudience({
        include: [
          { kind: "everyone" },
          { kind: "tag", tags: [] },
          { kind: "buyers", product_codes: ["short", " short ", 5] },
          { kind: "buyers", product_codes: ["short"] },
          { kind: "enrolled", course_ids: ["nope", "11111111-2222-3333-4444-555555555555"] },
          { kind: "registered", opted_in_only: "yes" },
        ],
        exclude_tags: ["vip", ""],
      }),
    ).toEqual({
      include: [
        { kind: "buyers", product_codes: ["short"] },
        { kind: "enrolled", course_ids: ["11111111-2222-3333-4444-555555555555"] },
        { kind: "registered", opted_in_only: false },
      ],
      exclude_tags: ["vip"],
    });
  });

  it("turns anything that is not an object into an empty audience", () => {
    expect(normalizeAudience("drop table")).toEqual({ include: [] });
  });
});

describe("resend webhook signature", () => {
  const secretBytes = Buffer.from("topsecretkey-0123456789");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const sign = (id: string, ts: string, body: string) =>
    createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64");

  it("accepts a valid signature among several", () => {
    const body = '{"type":"email.opened","data":{"email_id":"e1"}}';
    const ts = "1700000000";
    expect(
      verifyResendWebhook({
        rawBody: body,
        secret,
        nowSeconds: 1700000010,
        headers: { id: "msg_1", timestamp: ts, signature: `v1,AAAA v1,${sign("msg_1", ts, body)}` },
      }),
    ).toBe(true);
  });

  it("refuses a changed body, an old timestamp and a missing header", () => {
    const body = '{"type":"email.opened"}';
    const ts = "1700000000";
    const signature = `v1,${sign("msg_1", ts, body)}`;
    const base = { secret, nowSeconds: 1700000010, headers: { id: "msg_1", timestamp: ts, signature } };
    expect(verifyResendWebhook({ ...base, rawBody: body + " " })).toBe(false);
    expect(verifyResendWebhook({ ...base, rawBody: body, nowSeconds: 1700009999 })).toBe(false);
    expect(verifyResendWebhook({ ...base, rawBody: body, headers: { ...base.headers, signature: null } })).toBe(false);
  });

  it("parses the fields it acts on", () => {
    expect(
      parseResendEvent({ type: "email.bounced", data: { email_id: "e1", to: ["a@b.co"], bounce: { type: "Permanent" } } }),
    ).toEqual({ type: "email.bounced", emailId: "e1", to: ["a@b.co"], bounceType: "Permanent" });
    expect(parseResendEvent(null)).toBeNull();
  });
});
