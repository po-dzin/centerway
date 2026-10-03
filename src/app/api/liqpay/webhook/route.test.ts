/**
 * LiqPay's webhook, end to end against an in-memory database. The handler is
 * the one `/api/wfp/webhook` uses and is covered there case by case; these
 * cases lock what is LiqPay's own: the envelope, the signature, its status
 * words, and what is stored.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { encodeLiqpayData, liqpaySignature } from "@/lib/payments/gateway/liqpay";
import { FakeSupabase } from "@/lib/admin/fakeSupabase";

// ---- collaborators ---------------------------------------------------------------

const db = new FakeSupabase();
db.uniqueKeys = { payments: [["provider", "order_ref"]] };
const sendPurchaseEmail = vi.fn<(input: Record<string, unknown>) => Promise<{ sent: boolean }>>(async () => ({
  sent: true,
}));
const sendConfirmedSaleTelegramReport = vi.fn<(orderRef: string) => Promise<{ sent: boolean }>>(async () => ({
  sent: true,
}));
const dispatchCapiEventInline = vi.fn();
const notifyHouseThread = vi.fn(async () => "sent");
const isStaffOrder = vi.fn(async () => false);
const loadPayableOffer = vi.fn(async () => ({
  pixelContentName: "Way21 Detox",
  fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
}));

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/email/purchaseEmail", () => ({ sendPurchaseEmail }));
vi.mock("@/lib/analytics/telegramReports", () => ({ sendConfirmedSaleTelegramReport }));
vi.mock("@/lib/tracking/capiDispatch", () => ({ dispatchCapiEventInline }));
vi.mock("@/lib/tracking/staffOrders", () => ({ isStaffOrder }));
vi.mock("@/lib/platform/offers", () => ({ loadPayableOffer }));
vi.mock("@/lib/telegram/houseThread", () => ({ notifyHouseThread }));
vi.mock("@/lib/jobs/worker", () => ({ buildPurchaseCapiEventPayload: vi.fn(async () => ({})) }));

const { POST } = await import("./route");

const PRIVATE = "liqpay-test-private";
const ORDER = "way21_20261003_ab12";

function callback(over: Record<string, unknown> = {}, privateKey = PRIVATE): Record<string, string> {
  const data = encodeLiqpayData({
    order_id: ORDER,
    status: "success",
    amount: 4100,
    currency: "UAH",
    payment_id: 2000000001,
    end_date: 1760000000000,
    sender_phone: "380501112233",
    ...over,
  });
  return { data, signature: liqpaySignature(data, privateKey) };
}

async function post(payload: Record<string, string>) {
  return POST(
    new NextRequest("https://www.centerway.net.ua/api/liqpay/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    }),
  );
}

beforeEach(() => {
  process.env.LIQPAY_PRIVATE_KEY = PRIVATE;
  db.tables = {
    orders: [
      {
        id: "o1",
        order_ref: ORDER,
        status: "created",
        product_code: "way21",
        customer_id: null,
        amount: 4100,
        currency: "UAH",
      },
    ],
    payments: [],
    customers: [],
    events: [],
    jobs: [],
  };
  db.failures = {};
  for (const m of [sendPurchaseEmail, sendConfirmedSaleTelegramReport, dispatchCapiEventInline, notifyHouseThread])
    m.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/liqpay/webhook", () => {
  it("refuses a callback signed with another key before touching a table", async () => {
    const res = await post(callback({}, "someone-else"));
    expect(res.status).toBe(403);
    expect(db.tables.payments).toHaveLength(0);
    expect(db.tables.orders![0]!.status).toBe("created");
  });

  it("records a success as paid under provider liqpay, storing the decoded fields", async () => {
    const res = await post(callback());
    expect(res.status).toBe(200);
    expect(db.tables.payments).toHaveLength(1);
    expect(db.tables.payments![0]).toMatchObject({
      provider: "liqpay",
      order_ref: ORDER,
      status: "paid",
      provider_tx_id: "2000000001",
    });
    expect((db.tables.payments![0]!.raw_payload as Record<string, string>).status).toBe("success");
    expect(db.tables.orders![0]!.status).toBe("paid");
    expect(db.tables.customers![0]).toMatchObject({ phone: "380501112233" });
    expect(sendConfirmedSaleTelegramReport).toHaveBeenCalledWith(ORDER);
  });

  it("sends the receipt when LiqPay echoes the buyer's email", async () => {
    await post(callback({ sender_email: "Buyer@Example.com" }));
    expect(sendPurchaseEmail.mock.calls[0]![0]).toMatchObject({ email: "buyer@example.com", orderRef: ORDER });
  });

  it("does not open access for a test-mode payment", async () => {
    await post(callback({ status: "sandbox" }));
    expect(db.tables.orders![0]!.status).toBe("created");
    expect(sendPurchaseEmail).not.toHaveBeenCalled();
  });

  it("takes access away on reversed", async () => {
    await post(callback());
    await post(callback({ status: "reversed" }));
    expect(db.tables.orders![0]!.status).toBe("refunded");
  });

  it("refuses a success for a different sum than the order", async () => {
    await post(callback({ amount: 1 }));
    expect(db.tables.orders![0]!.status).toBe("created");
    expect(db.tables.payments).toHaveLength(0);
    expect(notifyHouseThread).toHaveBeenCalledTimes(1);
  });
});
