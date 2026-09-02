/**
 * The manual reconcile endpoint — the one place outside the payment callback
 * that writes the column entitlement is read from.
 *
 * `acceptedPaidOrders` asks only whether `orders.status` reads "paid". Until
 * 2026-09-02 this route took that value straight out of the request body with
 * no allowlist and no role check above the shared staff gate, so a typo closed
 * a paying customer's course and any staff account could open one for free.
 * These tests are about those two gates and about the receipt that was never
 * sent — not about Postgres.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase, type Row } from "./fakeSupabase";

const db = new FakeSupabase();
const session = { value: null as null | { user: { id: string }; role: string } };

vi.mock("@/lib/auth/requireAdmin", () => ({
    requireAdmin: async () => session.value,
}));

vi.mock("@/lib/auth/adminClient", () => ({
    adminClient: () => db,
}));

const sendPurchaseEmail = vi.fn<(input: unknown) => Promise<{ sent: true }>>(async () => ({ sent: true }));
vi.mock("@/lib/email/purchaseEmail", () => ({
    sendPurchaseEmail: (input: unknown) => sendPurchaseEmail(input as never),
}));

vi.mock("@/lib/platform/offers", () => ({
    loadPayableOffer: async () => ({
        code: "course:reset-day",
        pixelContentName: "Reset Day",
        fulfilment: { kind: "course", courseSlug: "reset-day" },
        currency: "UAH",
    }),
}));

const orders = await import("@/app/api/admin/orders/route");

const ADMIN = { user: { id: "auth-admin" }, role: "admin" };
const SUPPORT = { user: { id: "auth-support" }, role: "support" };

const ORDER_REF = "manual_course-reset-day_20260902_ab12";

function patch(body: unknown) {
    return new NextRequest("http://localhost/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function orderRow(): Row {
    return db.rows("orders").find((row) => row.order_ref === ORDER_REF) as Row;
}

beforeEach(() => {
    db.tables = {
        customers: [{ id: "cus-1", email: "buyer@example.com" }],
        orders: [
            {
                id: "ord-1",
                order_ref: ORDER_REF,
                product_code: "course:reset-day",
                amount: 795,
                currency: "UAH",
                status: "created",
                customer_id: "cus-1",
            },
        ],
        audit_log: [],
    };
    session.value = ADMIN;
    sendPurchaseEmail.mockClear();
});

describe("PATCH /api/admin/orders — the allowlist", () => {
    it("refuses a status the system does not have, without touching the row", async () => {
        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "payed" }));

        expect(res.status).toBe(400);
        // The typo that would have silently closed a paying customer's course.
        expect(orderRow().status).toBe("created");
        expect(sendPurchaseEmail).not.toHaveBeenCalled();
    });

    it("accepts every status the transition model knows", async () => {
        for (const status of ["created", "paid", "refunded"]) {
            const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status }));
            expect(res.status).toBe(200);
            expect(orderRow().status).toBe(status);
        }
    });

    it("refuses an order reference that does not exist rather than reporting success", async () => {
        const res = await orders.PATCH(patch({ order_ref: "nope", status: "paid" }));
        expect(res.status).toBe(400);
    });
});

describe("PATCH /api/admin/orders — who may confirm money", () => {
    it("refuses support marking an order paid: that is entitlement out of nothing", async () => {
        session.value = SUPPORT;

        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid" }));

        expect(res.status).toBe(403);
        expect(orderRow().status).toBe("created");
        expect(sendPurchaseEmail).not.toHaveBeenCalled();
    });

    it("lets support take access away, because removing is not giving", async () => {
        session.value = SUPPORT;

        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "refunded" }));

        expect(res.status).toBe(200);
        expect(orderRow().status).toBe("refunded");
    });

    it("refuses everyone without a session", async () => {
        session.value = null;

        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid" }));

        expect(res.status).toBe(401);
        expect(orderRow().status).toBe("created");
    });
});

describe("PATCH /api/admin/orders — the receipt", () => {
    it("tells the buyer when a sale is confirmed by hand, because no gateway did", async () => {
        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid", note: "bank transfer" }));

        expect(res.status).toBe(200);
        expect(sendPurchaseEmail).toHaveBeenCalledTimes(1);
        expect(sendPurchaseEmail).toHaveBeenCalledWith(
            expect.objectContaining({ email: "buyer@example.com", amount: 795, orderRef: ORDER_REF })
        );
    });

    it("does not mail again when an order that already read paid is re-saved", async () => {
        await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid" }));
        sendPurchaseEmail.mockClear();

        await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid" }));

        expect(sendPurchaseEmail).not.toHaveBeenCalled();
    });

    it("does not mail on a refund", async () => {
        await orders.PATCH(patch({ order_ref: ORDER_REF, status: "refunded" }));
        expect(sendPurchaseEmail).not.toHaveBeenCalled();
    });

    it("completes the reconcile even when there is nobody to mail", async () => {
        db.tables = {
            customers: [],
            orders: [{ ...orderRow(), customer_id: null }],
            audit_log: [],
        };

        const res = await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid" }));

        // The sale is still confirmed — a missing address is not a reason to
        // refuse money that arrived.
        expect(res.status).toBe(200);
        expect(orderRow().status).toBe("paid");
        expect(sendPurchaseEmail).not.toHaveBeenCalled();
    });
});

describe("PATCH /api/admin/orders — the audit trail", () => {
    it("records what the status was, not only what it became", async () => {
        await orders.PATCH(patch({ order_ref: ORDER_REF, status: "paid", note: "cash" }));

        const entry = db.rows("audit_log").find((row) => row.action === "order.reconcile") as Row;
        expect(entry).toMatchObject({
            actor_id: "auth-admin",
            entity_id: ORDER_REF,
            metadata: { previous_status: "created", new_status: "paid", note: "cash" },
        });
    });
});
