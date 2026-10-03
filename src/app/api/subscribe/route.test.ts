/**
 * `/api/subscribe` — the public way onto the email list (2026-10-03).
 *
 * What is held here is what would cost the most to get wrong on a public,
 * unauthenticated form:
 *
 *   · no consent, no address, no known placement → refused, nothing written;
 *   · pressing twice is one row, not two, and the answer does not change;
 *   · an explicit yes after an unsubscribe re-subscribes, with a fresh consent;
 *   · a bounce or a spam complaint is never undone by a form;
 *   · the answer never says whether the address was already known;
 *   · a filled honeypot is accepted and dropped;
 *   · a database without the consent columns still takes the subscription.
 *
 * Runs the real `subscribeByForm` against the in-memory database; the rate
 * limiter is the boundary that is stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
const enforceRateLimit = vi.fn(async () => ({ allowed: true, retryAfter: 0, count: 1 }));

vi.mock("@/lib/db/server", () => ({ serviceClient: () => db }));
vi.mock("@/lib/api/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rateLimit")>()),
  enforceRateLimit,
}));

const { POST } = await import("./route");

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("https://www.centerway.net.ua/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const valid = { email: "  Olena@Example.COM ", consent: true, source: "footer", company: "" };

function rows(): Row[] {
  return db.tables.messaging_subscriptions ?? [];
}

beforeEach(() => {
  db.tables = { messaging_subscriptions: [] };
  db.failures = {};
  db.uniqueKeys = { messaging_subscriptions: [["channel", "address"]] };
  enforceRateLimit.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validation", () => {
  it("refuses without explicit consent and writes nothing", async () => {
    for (const consent of [undefined, false, "true", "on", 1]) {
      const res = await post({ ...valid, consent });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "consent_required" });
    }
    expect(rows()).toHaveLength(0);
  });

  it("refuses what is not an address", async () => {
    for (const email of [
      undefined,
      "",
      "olena",
      "olena@",
      "@example.com",
      "a b@example.com",
      `${"a".repeat(250)}@x.ua`,
    ]) {
      const res = await post({ ...valid, email });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("email_invalid");
    }
    expect(rows()).toHaveLength(0);
  });

  it("refuses a placement the code does not know", async () => {
    const res = await post({ ...valid, source: "sendpulse_import" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("source_invalid");
    expect(rows()).toHaveLength(0);
  });

  it("refuses a body that is not a JSON object", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post([valid])).status).toBe(400);
  });

  it("answers 429 when the limiter says so, before reading anything", async () => {
    enforceRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30, count: 11 });
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(rows()).toHaveLength(0);
  });
});

describe("subscribing", () => {
  it("stores a new address normalised, with the form as its source and a consent stamp", async () => {
    const res = await post(valid, { cookie: "cw_ref=olena; cw_utm=utm_source%3Dig%26utm_campaign%3Dautumn" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(rows()).toHaveLength(1);
    const row = rows()[0]!;
    expect(row).toMatchObject({
      channel: "email",
      address: "olena@example.com",
      status: "subscribed",
      source: "form_footer",
      status_reason: "subscribe_form",
      consent_source: "footer",
      attribution: { ref: "olena", utm: { source: "ig", campaign: "autumn" } },
    });
    expect(typeof row.consented_at).toBe("string");
  });

  it("is idempotent: pressing twice is one row and the same answer", async () => {
    const first = await post(valid);
    const second = await post({ ...valid, email: "olena@example.com" });
    expect(await first.json()).toEqual({ ok: true });
    expect(await second.json()).toEqual({ ok: true });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ status: "subscribed", source: "form_footer" });
  });

  it("keeps an imported row's source and adds the consent it never had", async () => {
    db.tables.messaging_subscriptions = [
      { id: "s-1", channel: "email", address: "olena@example.com", status: "subscribed", source: "sendpulse_import" },
    ];
    const res = await post(valid);
    expect(await res.json()).toEqual({ ok: true });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ source: "sendpulse_import", status: "subscribed", consent_source: "footer" });
    expect(typeof rows()[0]!.consented_at).toBe("string");
  });

  it("re-subscribes someone who unsubscribed, with a fresh consent and status stamp", async () => {
    db.tables.messaging_subscriptions = [
      {
        id: "s-1",
        channel: "email",
        address: "olena@example.com",
        status: "unsubscribed",
        source: "csv_import",
        status_reason: "one_click",
        status_broadcast_id: "b-1",
        status_changed_at: "2026-09-20T10:00:00.000Z",
        consented_at: null,
      },
    ];
    const res = await post(valid);
    expect(await res.json()).toEqual({ ok: true });
    const row = rows()[0]!;
    expect(row).toMatchObject({
      status: "subscribed",
      status_reason: "subscribe_form",
      status_broadcast_id: null,
      source: "csv_import",
    });
    expect(row.status_changed_at).not.toBe("2026-09-20T10:00:00.000Z");
    expect(row.consented_at).toBe(row.status_changed_at);
  });

  it("never undoes a bounce or a complaint, and answers exactly as for anyone else", async () => {
    db.tables.messaging_subscriptions = [
      { id: "s-1", channel: "email", address: "bounce@example.com", status: "bounced", source: "csv_import" },
      { id: "s-2", channel: "email", address: "spam@example.com", status: "complained", source: "csv_import" },
    ];
    for (const email of ["bounce@example.com", "spam@example.com"]) {
      const res = await post({ ...valid, email });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    }
    expect(rows().map((row) => row.status)).toEqual(["bounced", "complained"]);
    expect(rows().every((row) => row.consented_at === undefined)).toBe(true);
  });

  it("does not take attribution from the body", async () => {
    await post({ ...valid, ref: "someone-else", utm_campaign: "fake" });
    expect(rows()[0]!.attribution).toBeNull();
  });

  it("answers 500 without detail when the database fails", async () => {
    db.failures = { "messaging_subscriptions:insert": "connection reset" };
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "subscribe_failed" });
  });

  it("still subscribes on a database that has no consent columns yet", async () => {
    const realFrom = db.from.bind(db);
    let refused = 0;
    vi.spyOn(db, "from").mockImplementation(((table: string) => {
      const query = realFrom(table);
      const insert = query.insert.bind(query);
      query.insert = ((values: Row) => {
        if ("consented_at" in values) {
          refused += 1;
          return {
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({
                data: null,
                error: { code: "PGRST204", message: "Could not find the 'attribution' column" },
              }).then(resolve),
          };
        }
        return insert(values);
      }) as typeof query.insert;
      return query;
    }) as typeof db.from);

    const res = await post(valid);
    expect(await res.json()).toEqual({ ok: true });
    expect(refused).toBe(1);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ address: "olena@example.com", status: "subscribed", source: "form_footer" });
    expect(rows()[0]!.consented_at).toBeUndefined();
  });
});

describe("honeypot", () => {
  it("accepts and drops a request whose hidden field is filled", async () => {
    const res = await post({ ...valid, company: "Acme LLC" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rows()).toHaveLength(0);
  });

  it("drops it even when the rest of the request is invalid, so a bot learns nothing", async () => {
    const res = await post({ email: "nope", consent: false, source: "x", company: "bot" });
    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(0);
  });
});
