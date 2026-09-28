/**
 * The lead form's door, `/api/leads`, for a program sold in formats
 * (2026-09-25).
 *
 * A guided or cohort format sold on request (`way21-support`, mode `lead`) has
 * its own code, and the request it produces must be filed and announced under
 * THAT code — before the one channel through `describeOffer` it arrived as a
 * generic consultation, and the team could not tell a 9 000 ₴ guided-format
 * request from «ask us anything». A code no offer answers to is a request to
 * the platform. And a form without a way to reach the person is still refused.
 *
 * Runs the real `describeOffer` and `persistLeadBestEffort` against the
 * in-memory database; the Telegram notifier, the customer spine and the rate
 * limiter are the boundaries that are stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
const sendTelegramMessage = vi.fn(async () => undefined);
const upsertCustomerByContact = vi.fn(async () => ({ id: "cust-1", created: false }));
const enforceRateLimit = vi.fn(async () => ({ allowed: true, retryAfter: 0, count: 1 }));

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/telegram/tg", () => ({ sendTelegramMessage }));
vi.mock("@/lib/platform/customerIdentity", () => ({ upsertCustomerByContact }));
vi.mock("@/lib/dosha/doshaTestRepo", () => ({
  applyDoshaTagsToCustomer: vi.fn(async () => undefined),
  loadTestAttempt: vi.fn(async () => null),
}));
vi.mock("@/lib/api/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rateLimit")>()),
  enforceRateLimit,
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new NextRequest("https://www.centerway.net.ua/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const offerRow = (over: Partial<Row>): Row => ({
  id: "offer-way21",
  experience_id: "exp-way21",
  code: "course:way21",
  mode: "checkout",
  amount: 1795,
  list_amount: null,
  currency: "UAH",
  access_days: null,
  access_lifetime: true,
  invoice_heading: null,
  invoice_description: null,
  share_pct: null,
  pixel_content_name: null,
  active: true,
  format: null,
  label: null,
  ...over,
});

const env = { ...process.env };

beforeEach(() => {
  db.tables = {
    experience_offers: [
      offerRow({}),
      offerRow({ id: "offer-support", code: "way21-support", mode: "lead", amount: 9000, format: "individual" }),
      offerRow({ id: "offer-consult", code: "consult", experience_id: "exp-consult", mode: "lead", amount: null }),
    ],
    offer_aliases: [{ code: "way21_support", offer_id: "offer-support" }],
    experiences: [
      { id: "exp-way21", kind: "course", slug: "way21", title: "Шлях 21" },
      { id: "exp-consult", kind: "consultation", slug: "consult", title: "Консультація" },
    ],
    lms_courses: [{ slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" }],
    leads: [],
    events: [],
    jobs: [],
  };
  db.failures = {};
  process.env.SUPPORT_CHAT_ID = "-100123";
  delete process.env.LEADS_THREAD_ID;
  delete process.env.SUPPORT_THREAD_ID;
  sendTelegramMessage.mockClear();
  upsertCustomerByContact.mockClear();
  enforceRateLimit.mockClear();
});

afterEach(() => {
  process.env = { ...env };
});

describe("POST /api/leads — formats of a program", () => {
  it("files a request for a lead format under the format's own code and tells the team which one", async () => {
    const res = await post({ name: "Олена", phone: "+380501112233", product: "way21-support", event_id: "evt-9" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; order_ref: string };
    expect(body.ok).toBe(true);
    expect(body.order_ref).toMatch(/^lead_way21-support_\d{8}_[0-9a-f]{8}$/);

    expect(db.tables.leads).toHaveLength(1);
    expect(db.tables.leads![0]).toMatchObject({ product_code: "way21-support", name: "Олена" });

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(String((sendTelegramMessage.mock.calls[0] as unknown[])[1])).toContain("Програма: way21-support");

    expect(db.tables.jobs![0]!.payload).toMatchObject({ event_name: "Lead", content_ids: ["way21-support"] });
  });

  it("files an old spelling of the format under the offer's own code, via `product_code` too", async () => {
    await post({ name: "Олена", email: "O@Example.com", product_code: "way21_support" });
    expect(db.tables.leads![0]).toMatchObject({ product_code: "way21-support", email: "o@example.com" });
  });

  it("does not turn a format request into a generic consultation", async () => {
    await post({ name: "Олена", phone: "+380501112233", product: "way21-support" });
    expect(db.tables.leads![0]!.product_code).not.toBe("consult");
    expect(db.tables.leads![0]!.product_code).not.toBe("platform");
  });

  it("files a code no offer answers to as a request to the platform, as before", async () => {
    await post({ name: "Олена", phone: "+380501112233", product: "way21-vip" });
    expect(db.tables.leads![0]).toMatchObject({ product_code: "platform" });
    await post({ name: "Ігор", phone: "+380501110000" });
    expect(db.tables.leads![1]).toMatchObject({ product_code: "platform" });
  });

  it("still files the request when the catalogue cannot be read", async () => {
    db.failures = { "experience_offers:select": "boom" };
    const res = await post({ name: "Олена", phone: "+380501112233", product: "way21-support" });
    expect(res.status).toBe(200);
    expect(db.tables.leads![0]).toMatchObject({ product_code: "platform" });
  });

  it("refuses a form without a name or any way to reach the person", async () => {
    for (const body of [
      { phone: "+380501112233", product: "way21-support" },
      { name: "Олена", product: "way21-support" },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ ok: false, error: "contact_required" });
    }
    expect(db.tables.leads).toHaveLength(0);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("answers 429 when the limiter says so, before storing anything", async () => {
    enforceRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 9, count: 16 });
    const res = await post({ name: "Олена", phone: "+380501112233", product: "way21-support" });
    expect(res.status).toBe(429);
    expect(db.tables.leads).toHaveLength(0);
  });
});
