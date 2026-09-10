/**
 * The payment webhook, end to end against an in-memory database.
 *
 * `src/lib/payments/wfp.test.ts` covers the pure pieces — the signature, the
 * status machine — and until 2026-09-11 the 590-line handler that composes
 * them, writes five tables and talks to Meta, the buyer and the operator had
 * no test at all. These are the cases that have actually gone wrong in
 * production or would cost money if they did: a forged callback, a redelivery,
 * a decline arriving after the payment, a decline followed by a success on the
 * same invoice (four real sales vanished from revenue that way), a QA order,
 * and a database that refuses a write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { computeWfpCallbackSignature } from "@/lib/payments/wfp";
import { FakeSupabase } from "@/lib/admin/fakeSupabase";

// ---- collaborators ---------------------------------------------------------------

const db = new FakeSupabase();
db.uniqueKeys = { payments: [["provider", "order_ref"]] };
const sendPurchaseEmail = vi.fn<(input: Record<string, unknown>) => Promise<{ sent: boolean }>>(async () => ({ sent: true }));
const sendConfirmedSaleTelegramReport = vi.fn<(orderRef: string) => Promise<{ sent: boolean }>>(async () => ({ sent: true }));
const dispatchCapiEventInline = vi.fn();
const isStaffOrder = vi.fn(async () => false);
const loadPayableOffer = vi.fn(async () => ({ pixelContentName: "Way21 Detox", fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" } }));

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/email/purchaseEmail", () => ({ sendPurchaseEmail }));
vi.mock("@/lib/analytics/telegramReports", () => ({ sendConfirmedSaleTelegramReport }));
vi.mock("@/lib/tracking/capiDispatch", () => ({ dispatchCapiEventInline }));
vi.mock("@/lib/tracking/staffOrders", () => ({ isStaffOrder }));
vi.mock("@/lib/platform/offers", () => ({ loadPayableOffer }));
vi.mock("@/lib/jobs/worker", () => ({ buildPurchaseCapiEventPayload: vi.fn(async () => ({})) }));

const { POST } = await import("./route");

const SECRET = "wfp-test-secret";
const MERCHANT = "test_merchant";
const ORDER = "way21-20260911-abc";

function callback(over: Record<string, string> = {}, opts: { sign?: boolean } = {}): Record<string, string> {
  const payload: Record<string, string> = {
    merchantAccount: MERCHANT,
    orderReference: ORDER,
    amount: "4100",
    currency: "UAH",
    authCode: "123456",
    cardPan: "44****1234",
    transactionStatus: "Approved",
    reasonCode: "1100",
    email: "Buyer@Example.com",
    phone: "+380501112233",
    rrn: "rrn-1",
    processingDate: "1757600000",
    ...over,
  };
  if (opts.sign !== false) payload.merchantSignature = computeWfpCallbackSignature(payload, SECRET);
  return payload;
}

async function post(payload: Record<string, string>) {
  return POST(new NextRequest("https://www.centerway.net.ua/api/wfp/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

beforeEach(() => {
  process.env.WFP_SECRET_KEY = SECRET;
  process.env.WFP_MERCHANT_ACCOUNT = MERCHANT;
  db.tables = { orders: [{ id: "o1", order_ref: ORDER, status: "created", product_code: "way21", customer_id: null }], payments: [], customers: [], events: [], jobs: [] };
  db.failures = {};
  for (const m of [sendPurchaseEmail, sendConfirmedSaleTelegramReport, dispatchCapiEventInline, isStaffOrder, loadPayableOffer]) m.mockClear();
  isStaffOrder.mockResolvedValue(false);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/wfp/webhook", () => {
  it("refuses an unsigned callback before touching a single table", async () => {
    const res = await post(callback({}, { sign: false }));
    expect(res.status).toBe(403);
    expect(db.tables.payments).toHaveLength(0);
    expect(db.tables.orders[0].status).toBe("created");
    expect(dispatchCapiEventInline).not.toHaveBeenCalled();
    expect(sendPurchaseEmail).not.toHaveBeenCalled();
  });

  it("refuses with a 500, not a 403, when the secret is not configured — a deploy problem, not an attacker", async () => {
    delete process.env.WFP_SECRET_KEY;
    const res = await post(callback());
    expect(res.status).toBe(500);
    expect(db.tables.payments).toHaveLength(0);
  });

  it("records a first approval everywhere it belongs, and answers the signed acceptance", async () => {
    const res = await post(callback());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.orderReference).toBe(ORDER);
    expect(body.status).toBe("accept");
    expect(typeof body.signature).toBe("string");

    expect(db.tables.payments).toHaveLength(1);
    expect(db.tables.payments[0]).toMatchObject({ provider: "wfp", order_ref: ORDER, status: "paid", provider_tx_id: "rrn-1" });
    expect(db.tables.orders[0].status).toBe("paid");

    expect(db.tables.customers).toHaveLength(1);
    expect(db.tables.customers[0]).toMatchObject({ email: "buyer@example.com", phone: "+380501112233" });
    expect(db.tables.orders[0].customer_id).toBe(db.tables.customers[0].id);

    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.events[0]).toMatchObject({ type: "payment_paid", order_ref: ORDER });

    const purchase = db.tables.jobs.filter((j) => j.type === "meta:capi");
    expect(purchase).toHaveLength(1);
    expect(purchase[0].payload).toMatchObject({ event_name: "Purchase", order_ref: ORDER, value: 4100, currency: "UAH", payment_event_time: 1757600000 });
    expect(dispatchCapiEventInline).toHaveBeenCalledTimes(1);

    expect(sendPurchaseEmail).toHaveBeenCalledTimes(1);
    expect(sendPurchaseEmail.mock.calls[0][0]).toMatchObject({ email: "buyer@example.com", productTitle: "Way21 Detox", amount: 4100, orderRef: ORDER });
    expect(sendConfirmedSaleTelegramReport).toHaveBeenCalledWith(ORDER);
  });

  it("is idempotent under redelivery: the same approval twice writes each fact once", async () => {
    await post(callback());
    const res = await post(callback());
    expect(res.status).toBe(200);
    expect(db.tables.payments).toHaveLength(1);
    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.jobs.filter((j) => j.type === "meta:capi")).toHaveLength(1);
    expect(db.tables.customers).toHaveLength(1);
    expect(dispatchCapiEventInline).toHaveBeenCalledTimes(1);
  });

  it("never un-sells: a decline that arrives after the payment leaves the order paid", async () => {
    await post(callback());
    const res = await post(callback({ transactionStatus: "Declined", reasonCode: "1105", rrn: "rrn-2" }));
    expect(res.status).toBe(200);
    expect(db.tables.orders[0].status).toBe("paid");
    expect(db.tables.payments[0].status).toBe("paid");
  });

  it("moves the payment row forward when a decline is followed by a success on the same invoice", async () => {
    // The four production orders of 2026-04/06: `orders` said paid, `payments`
    // stayed at the first callback's decline, and revenue never saw the sale.
    await post(callback({ transactionStatus: "Declined", reasonCode: "1105", rrn: "rrn-declined" }));
    expect(db.tables.orders[0].status).toBe("created");
    expect(db.tables.payments[0].status).toBe("created");
    expect(dispatchCapiEventInline).not.toHaveBeenCalled();

    const res = await post(callback({ rrn: "rrn-approved" }));
    expect(res.status).toBe(200);
    expect(db.tables.payments).toHaveLength(1);
    expect(db.tables.payments[0].status).toBe("paid");
    expect(db.tables.orders[0].status).toBe("paid");
    expect(dispatchCapiEventInline).toHaveBeenCalledTimes(1);
  });

  it("keeps a staff QA payment out of Meta but still sends the receipt and the report", async () => {
    isStaffOrder.mockResolvedValue(true);
    const res = await post(callback());
    expect(res.status).toBe(200);
    expect(db.tables.jobs.filter((j) => j.type === "meta:capi")).toHaveLength(0);
    expect(dispatchCapiEventInline).not.toHaveBeenCalled();
    expect(sendPurchaseEmail).toHaveBeenCalledTimes(1);
    expect(sendConfirmedSaleTelegramReport).toHaveBeenCalledTimes(1);
  });

  it("withholds the acceptance when a write fails, so the gateway redelivers", async () => {
    db.failures = { "orders:update": "connection reset" };
    const res = await post(callback());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "db_write_failed" });
    expect(sendPurchaseEmail).not.toHaveBeenCalled();
    expect(dispatchCapiEventInline).not.toHaveBeenCalled();
  });

  it("answers 400 to a body with no order reference", async () => {
    const res = await post({ transactionStatus: "Approved" });
    expect(res.status).toBe(400);
  });
});
