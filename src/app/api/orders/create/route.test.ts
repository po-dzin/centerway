/**
 * Order creation from the landings: the row this route writes is what the
 * entitlement later reads, so the cases that matter are the ones where the
 * wrong row — or a row for the wrong site — could be written. The origin gate,
 * the "no fallback product" rule, the tolerant attribution parsing, and the
 * one InitiateCheckout job per order that the Pixel dedupes against.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
const enforceRateLimit = vi.fn(async () => ({ allowed: true, retryAfter: 0, count: 1 }));
const loadPayableOffer = vi.fn(async (code: string) =>
  code === "way21" ? { code: "way21", amount: 4100, currency: "UAH", pixelContentName: "Way21 Detox" } : null,
);

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/platform/offers", () => ({ loadPayableOffer }));
vi.mock("@/lib/api/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rateLimit")>()),
  enforceRateLimit,
}));

const { POST, OPTIONS } = await import("./route");

const ctx = { params: Promise.resolve({}) };

function post(body: unknown, origin: string | null = "https://www.centerway.net.ua") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return POST(
    new NextRequest("https://www.centerway.net.ua/api/orders/create", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx,
  );
}

beforeEach(() => {
  db.tables = { orders: [], jobs: [] };
  enforceRateLimit.mockClear();
  enforceRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, count: 1 });
  loadPayableOffer.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/orders/create", () => {
  it("writes the order and one InitiateCheckout job, and answers with the reference", async () => {
    const res = await post({
      product_code: "way21",
      attrib: {
        fbp: "fb.1.1.2",
        fbc: "fb.1.1.abc",
        fbclid: "abc",
        utm_campaign: "spring",
        event_id: "evt-1",
        page_url: "https://www.centerway.net.ua/way21",
        client_ip: "1.2.3.4",
        client_ua: "UA",
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, product: "way21", amount: 4100, currency: "UAH", status: "created" });
    expect(String(body.order_ref)).toMatch(/^way21_\d{8}_[0-9a-f]{8}$/);

    expect(db.tables.orders).toHaveLength(1);
    expect(db.tables.orders[0]).toMatchObject({
      order_ref: body.order_ref,
      product_code: "way21",
      amount: 4100,
      status: "created",
      fbp: "fb.1.1.2",
      fbclid: "abc",
      campaign: "spring",
      page_url: "https://www.centerway.net.ua/way21",
    });

    expect(db.tables.jobs).toHaveLength(1);
    expect(db.tables.jobs[0]).toMatchObject({ type: "meta:capi", status: "pending" });
    expect(db.tables.jobs[0].payload).toMatchObject({
      event_name: "InitiateCheckout",
      event_id: "evt-1",
      order_ref: body.order_ref,
      value: 4100,
      currency: "UAH",
      content_name: "Way21 Detox",
      content_ids: ["way21"],
      fbc: "fb.1.1.abc",
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://www.centerway.net.ua");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("derives the event id from the order when the browser sent none, so the Purchase later dedupes against it", async () => {
    const res = await post({ product_code: "way21" });
    const body = (await res.json()) as { order_ref: string };
    expect(db.tables.jobs[0].payload).toMatchObject({ event_id: `checkout_${body.order_ref}` });
  });

  it("does not file a second InitiateCheckout for an event id it already has", async () => {
    db.tables.jobs.push({
      id: "j0",
      type: "meta:capi",
      payload: { event_name: "InitiateCheckout", event_id: "evt-dup" },
    });
    await post({ product_code: "way21", attrib: { event_id: "evt-dup" } });
    expect(db.tables.orders).toHaveLength(1);
    expect(db.tables.jobs).toHaveLength(1);
  });

  it("drops a broken attribution field instead of refusing the order", async () => {
    // The landings' common.js has sent null, undefined and the odd number here.
    const res = await post({
      product_code: "way21",
      attrib: { fbp: null, fbc: 42, utm_campaign: "   ", client_ip: undefined },
    });
    expect(res.status).toBe(200);
    expect(db.tables.orders[0]).toMatchObject({ fbp: null, campaign: null, client_ip: null });
  });

  it("refuses an unknown product with 404 rather than falling back to a default", async () => {
    const res = await post({ product_code: "short" });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: "unknown_product" });
    expect(db.tables.orders).toHaveLength(0);
  });

  it("answers 400 to a body without a product code or that is not JSON", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    expect(db.tables.orders).toHaveLength(0);
  });

  it("does not grant CORS to a foreign origin, but still serves same-origin callers", async () => {
    const foreign = await post({ product_code: "way21" }, "https://evil.example");
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    expect(foreign.headers.get("vary")).toBe("Origin");

    const preflight = await OPTIONS(
      new NextRequest("https://www.centerway.net.ua/api/orders/create", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const sub = await OPTIONS(
      new NextRequest("https://www.centerway.net.ua/api/orders/create", {
        method: "OPTIONS",
        headers: { origin: "https://my.centerway.net.ua" },
      }),
    );
    expect(sub.headers.get("access-control-allow-origin")).toBe("https://my.centerway.net.ua");

    const sameOrigin = await post({ product_code: "way21" }, null);
    expect(sameOrigin.status).toBe(200);
  });

  it("answers 429 with Retry-After when the limiter says so, before touching the catalogue", async () => {
    enforceRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 17, count: 31 });
    const res = await post({ product_code: "way21" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("17");
    expect(loadPayableOffer).not.toHaveBeenCalled();
    expect(db.tables.orders).toHaveLength(0);
  });
});
