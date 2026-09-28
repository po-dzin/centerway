/**
 * The platform's pay link, `/api/pay/start?product=<code>`, for a program sold
 * in formats (2026-09-25).
 *
 * Runs the real `loadPayableOffer` → `describeOffer` read against the in-memory
 * catalogue and the real invoice builder against a stand-in gateway, so what is
 * asserted is the row the webhook and the entitlement later read. The cases
 * that matter are money cases: a cohort format charged at ITS price and filed
 * under ITS code, a lead format that must never reach a gateway, and an unknown
 * code that used to fall back to Short Reboot and must now charge nothing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { PaymentGateway } from "@/lib/payments/gateway/types";

const hoisted = vi.hoisted(() => ({
  db: null as unknown as import("@/lib/admin/fakeSupabase").FakeSupabase,
  liveCourses: new Map<string, unknown>(),
}));
hoisted.db = new FakeSupabase();
const db = hoisted.db;

const createInvoice = vi.fn(async (request: { orderRef: string }) => ({
  ok: true as const,
  payUrl: `https://pay.example/${request.orderRef}`,
}));
const gateway = {
  id: "wayforpay",
  supportsSplit: false,
  callbackPath: "/api/wfp/webhook",
  missingEnv: () => [],
  createInvoice,
} as unknown as PaymentGateway;

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => hoisted.db }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/lms/liveCatalog", () => ({
  COURSE_LIST_TAG: "lms-courses",
  courseTag: (slug: string) => `lms-course:${slug}`,
  getLiveCourse: async (slug: string) => hoisted.liveCourses.get(slug) ?? null,
  listLiveCourses: async () => [...hoisted.liveCourses.values()],
}));
vi.mock("@/lib/tracking/capiDispatch", () => ({ dispatchCapiEventInline: () => undefined }));
vi.mock("@/lib/api/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rateLimit")>()),
  enforceRateLimit: async () => ({ allowed: true, retryAfter: 0, count: 1 }),
}));
vi.mock("@/lib/payments/paymentStart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/paymentStart")>();
  return {
    ...actual,
    createPaymentInvoice: (input: Parameters<typeof actual.createPaymentInvoice>[0]) =>
      actual.createPaymentInvoiceWithDeps(input, {
        db: hoisted.db as never,
        gateway,
        fetchFn: fetch,
        nowMs: () => Date.parse("2026-09-28T10:00:00Z"),
        randomHex: () => "ab12cd34",
      }),
  };
});

const { GET } = await import("./route");

function get(query: string) {
  return GET(new NextRequest(`https://www.centerway.net.ua/api/pay/start?${query}`));
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
  pixel_content_name: "Way21 Detox",
  active: true,
  format: null,
  label: null,
  ...over,
});

beforeEach(() => {
  db.tables = {
    experience_offers: [
      offerRow({}),
      offerRow({ id: "offer-group", code: "way21-group", amount: 4100, format: "group", pixel_content_name: null }),
      offerRow({ id: "offer-support", code: "way21-support", mode: "lead", amount: null, format: "individual" }),
      offerRow({ id: "offer-draft", code: "way21-duo", amount: 2500, format: "group", active: false }),
    ],
    offer_aliases: [{ code: "shlyah21-group", offer_id: "offer-group" }],
    experiences: [{ id: "exp-way21", kind: "course", slug: "way21", title: "Шлях 21" }],
    lms_courses: [{ slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" }],
    orders: [],
    jobs: [],
    events: [],
  };
  db.failures = {};
  hoisted.liveCourses.clear();
  hoisted.liveCourses.set("way21", {
    id: "c-way21",
    slug: "way21",
    programSlug: "way21",
    title: "Шлях 21",
    status: "published",
    visibility: "listed",
    modules: [],
    schedule: { mode: "daily" },
  });
  createInvoice.mockClear();
});

describe("GET /api/pay/start — formats of a program", () => {
  it("charges a group format at the format's amount and files the order under its own code", async () => {
    const res = await get("product=way21-group&format=json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, product: "way21-group" });
    expect(String(body.order_ref)).toBe("way21-group_20260928_ab12cd34");

    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(createInvoice.mock.calls[0]![0]).toMatchObject({ amount: 4100, currency: "UAH" });
    expect(db.tables.orders).toHaveLength(1);
    expect(db.tables.orders![0]).toMatchObject({ product_code: "way21-group", amount: 4100, status: "created" });
  });

  it("files an old spelling of the format under the offer's own code", async () => {
    await get("product=shlyah21-group&format=json");
    expect(db.tables.orders![0]).toMatchObject({ product_code: "way21-group", amount: 4100 });
  });

  it("redirects the browser to the gateway when JSON was not asked for", async () => {
    const res = await get("product=way21-group");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://pay.example/way21-group_20260928_ab12cd34");
  });

  it("does not open a checkout for a lead format", async () => {
    const res = await get("product=way21-support");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "unknown_product" });
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.tables.orders).toHaveLength(0);
  });

  it("does not open a checkout for an unapproved, inactive format", async () => {
    expect((await get("product=way21-duo")).status).toBe(404);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("answers an unknown format code with 404 and charges nothing — never a fallback product", async () => {
    for (const query of ["product=way21-vip", "product=", ""]) {
      const res = await get(query);
      expect(res.status).toBe(404);
    }
    expect(createInvoice).not.toHaveBeenCalled();
    expect(db.tables.orders).toHaveLength(0);
  });
});
