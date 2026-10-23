/**
 * «Додати продаж»: any admin session may record a product sold by hand, and
 * the body is checked before the library ever sees it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { requireAdminSession, recordProductSale } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  recordProductSale: vi.fn(),
}));

vi.mock("@/lib/api/adminRoute", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminSession,
    unauthorizedResponse: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    badRequestResponse: (error: string) => NextResponse.json({ error }, { status: 400 }),
    serverErrorResponse: (error: string) => NextResponse.json({ error }, { status: 500 }),
  };
});
vi.mock("@/lib/admin/manualSale", () => ({ recordProductSale }));
vi.mock("@/lib/admin/access", () => {
  class AccessError extends Error {
    constructor(
      message: string,
      readonly status = 400,
    ) {
      super(message);
    }
  }
  return { AccessError, isPaymentCurrency: (v: unknown) => v === "UAH" || v === "USD" || v === "EUR" };
});

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new NextRequest("http://x/api/admin/customers/sales", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  requireAdminSession.mockReset();
  recordProductSale.mockReset();
});

describe("POST /api/admin/customers/sales", () => {
  it("refuses without a session", async () => {
    requireAdminSession.mockResolvedValue(null);
    expect((await post({})).status).toBe(401);
  });

  it("refuses a bad amount, currency or a sale to nobody before writing", async () => {
    requireAdminSession.mockResolvedValue({ role: "support", user: { id: "u" } });
    expect((await post({ customerId: "c1", amount: 0, currency: "UAH" })).status).toBe(400);
    expect((await post({ customerId: "c1", amount: 10, currency: "PLN" })).status).toBe(400);
    expect((await post({ amount: 10, currency: "UAH", name: "Оля" })).status).toBe(400);
    expect(recordProductSale).not.toHaveBeenCalled();
  });

  it("records the sale as the signed-in operator", async () => {
    requireAdminSession.mockResolvedValue({ role: "support", user: { id: "u" } });
    recordProductSale.mockResolvedValue({ orderRef: "manual_x", customerId: "c1" });
    const res = await post({ phone: "0671234567", otherTitle: "Спеції", amount: "120", currency: "UAH" });
    expect(res.status).toBe(201);
    expect(recordProductSale).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 120, currency: "UAH", actorId: "u", otherTitle: "Спеції" }),
    );
  });
});
