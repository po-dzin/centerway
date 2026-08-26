/**
 * The access window: from when, until when, and who may re-open it.
 *
 * These are the scenarios the access brief asks to be proven, taken at the one
 * door every learner surface passes through (`ensureEnrollment`). Testing it is
 * testing the course page, the lesson page and every progress write at once.
 *
 * The rules under test, stated once:
 *   · A purchase opens a window counted from the PAYMENT, for the term the
 *     OFFER declares. Day 1 of the drip is a separate clock and still starts at
 *     the first opening.
 *   · Buying again while access is live ADDS the term; buying again after it
 *     lapsed opens a new window. Neither resets anything.
 *   · A revoke outranks the purchase that paid for it; a LATER purchase
 *     outranks the revoke. A ban outranks everything, forever.
 *   · Access to one course never touches another.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { Course } from "@/lms-core";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
    adminClient: () => db,
}));

const { ensureEnrollment } = await import("./server");

const NOW = new Date("2026-08-26T12:00:00.000Z");

const RESET = {
    id: "course-reset",
    slug: "reset-day",
    status: "published",
    entitlementProductCodes: ["reset-day"],
} as unknown as Course;

const WAY21 = {
    id: "course-way21",
    slug: "way21",
    status: "published",
    entitlementProductCodes: ["way21"],
} as unknown as Course;

const IDENTITY = { authUserId: "auth-1", email: "learner@example.com", emailVerified: true };

type Seed = {
    orders?: Row[];
    enrollments?: Row[];
    offers?: Row[];
};

function order(ref: string, createdAt: string, productCode = "reset-day"): Row {
    return { order_ref: ref, product_code: productCode, status: "paid", customer_id: "cus-1", created_at: createdAt };
}

/** A 30-day offer on Reset Day unless a test says otherwise. */
function offer(courseId: string, days: number | null, lifetime = false): Row {
    return { course_id: courseId, code: `course:${courseId}`, access_days: days, access_lifetime: lifetime, active: true };
}

function seed(input: Seed = {}) {
    db.tables = {
        lms_enrollments: input.enrollments ?? [],
        lms_course_offers: input.offers ?? [offer("course-reset", 30)],
        platform_users: [{ auth_user_id: "auth-1", email: "learner@example.com", timezone: "Europe/Kyiv" }],
        user_roles: [],
        customers: [{ id: "cus-1", email: "learner@example.com", auth_user_id: "auth-1" }],
        orders: input.orders ?? [],
        access_tokens: [],
        lms_progress_events: [],
    };
    db.failures = {};
}

function enrollment(overrides: Row = {}): Row {
    return {
        id: "enr-1",
        course_id: "course-reset",
        auth_user_id: "auth-1",
        source: "order",
        order_ref: "ord-1",
        status: "active",
        started_at: "2026-08-20T00:00:00.000Z",
        expires_at: null,
        revoked_at: null,
        blocked_at: null,
        ...overrides,
    };
}

const row = () => db.rows("lms_enrollments")[0] as Row;

beforeEach(() => seed());

describe("a learner with no purchases", () => {
    it("is refused, and nothing is written", async () => {
        const result = await ensureEnrollment(IDENTITY, RESET, NOW);

        expect(result).toEqual({ enrollment: null, reason: "not_entitled" });
        expect(db.rows("lms_enrollments")).toHaveLength(0);
    });
});

describe("the first purchase", () => {
    it("opens a window counted from the payment, for the offer's term", async () => {
        seed({ orders: [order("ord-1", "2026-08-20T09:00:00.000Z")] });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);

        // 20 Aug + 30 days.
        expect(result.enrollment).toMatchObject({ orderRef: "ord-1", expiresAt: "2026-09-19T09:00:00.000Z" });
        // The DRIP clock is the other one, and it starts today, not on the 20th.
        expect(row().started_at).toBe(NOW.toISOString());
    });

    it("has no end when the offer is sold as lifetime", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z")],
            offers: [offer("course-reset", null, true)],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result.enrollment).toMatchObject({ expiresAt: null });
    });

    /* An offer nobody configured must not lock out someone who has paid. The
       place that refuses an unstated term is the offer tool, before a sale. */
    it("has no end when the course has no offer row at all", async () => {
        seed({ orders: [order("ord-1", "2026-08-20T09:00:00.000Z")], offers: [] });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result.enrollment).toMatchObject({ expiresAt: null });
    });

    /* Withdrawing an offer stops new sales; it must not erase the term a
       buyer already agreed to. `code` is unique per course, so there is one
       row and no history to fall back to — reading only the active row used
       to make a withdrawn offer look unconfigured, which reads as lifetime:
       exactly backwards for someone whose window should still close on time. */
    it("still applies the term of an offer that has since been withdrawn", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z")],
            offers: [{ ...offer("course-reset", 30), active: false }],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result.enrollment).toMatchObject({ orderRef: "ord-1", expiresAt: "2026-09-19T09:00:00.000Z" });
    });

    /* Bought in May, 30-day term, opened in August: the window closed unopened.
       Nothing is written — a dead row would have to be stepped over on every
       later purchase, and it carries no progress worth keeping. */
    it("is refused when the term already ran out before the first visit", async () => {
        seed({ orders: [order("ord-1", "2026-05-01T09:00:00.000Z")] });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result).toEqual({ enrollment: null, reason: "expired" });
        expect(db.rows("lms_enrollments")).toHaveLength(0);
    });
});

describe("a window that has lapsed", () => {
    it("closes the course but keeps the row and its progress", async () => {
        seed({
            orders: [order("ord-1", "2026-07-01T09:00:00.000Z")],
            enrollments: [enrollment({ expires_at: "2026-07-31T09:00:00.000Z" })],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);

        expect(result).toEqual({ enrollment: null, reason: "expired" });
        expect(db.rows("lms_enrollments")).toHaveLength(1);
    });

    it("re-opens on a fresh purchase, counted from that payment", async () => {
        seed({
            orders: [order("ord-1", "2026-07-01T09:00:00.000Z"), order("ord-2", "2026-08-26T08:00:00.000Z")],
            enrollments: [enrollment({ expires_at: "2026-07-31T09:00:00.000Z" })],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);

        expect(result.enrollment).toMatchObject({ orderRef: "ord-2", expiresAt: "2026-09-25T08:00:00.000Z" });
        // One row, not two: the learner returns to the progress they had.
        expect(db.rows("lms_enrollments")).toHaveLength(1);
    });
});

describe("buying again before the window closes", () => {
    /* THE ACCIDENTAL RESET the brief warns about (§8): a second purchase must
       add to what is left, never replace it. */
    it("adds the term to the days already paid for", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z"), order("ord-2", "2026-08-26T08:00:00.000Z")],
            enrollments: [enrollment({ expires_at: "2026-09-19T09:00:00.000Z" })],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);

        // 19 Sep + 30 days, not "today + 30".
        expect(result.enrollment).toMatchObject({ orderRef: "ord-2", expiresAt: "2026-10-19T09:00:00.000Z" });
    });

    it("does not extend again on the next visit — the same purchase pays once", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z"), order("ord-2", "2026-08-26T08:00:00.000Z")],
            enrollments: [enrollment({ expires_at: "2026-09-19T09:00:00.000Z" })],
        });

        await ensureEnrollment(IDENTITY, RESET, NOW);
        const again = await ensureEnrollment(IDENTITY, RESET, NOW);

        expect(again.enrollment).toMatchObject({ expiresAt: "2026-10-19T09:00:00.000Z" });
    });
});

describe("an operator's decisions", () => {
    it("a revoke closes the course, and the purchase that paid for it does not re-open it", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z")],
            enrollments: [
                enrollment({ status: "revoked", revoked_at: "2026-08-25T00:00:00.000Z", expires_at: null }),
            ],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result).toEqual({ enrollment: null, reason: "revoked" });
    });

    it("a LATER purchase re-opens a revoked seat", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z"), order("ord-2", "2026-08-26T08:00:00.000Z")],
            enrollments: [
                enrollment({ status: "revoked", revoked_at: "2026-08-25T00:00:00.000Z", expires_at: null }),
            ],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result.enrollment).toMatchObject({ orderRef: "ord-2", expiresAt: "2026-09-25T08:00:00.000Z" });
        expect(row().status).toBe("active");
    });

    /* The difference between the two closed states: a ban has no price. */
    it("a ban survives a new purchase", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z"), order("ord-2", "2026-08-26T08:00:00.000Z")],
            enrollments: [enrollment({ blocked_at: "2026-08-25T00:00:00.000Z" })],
        });

        const result = await ensureEnrollment(IDENTITY, RESET, NOW);
        expect(result).toEqual({ enrollment: null, reason: "blocked" });
        expect(row().status).toBe("active");
    });
});

describe("several programs on one account", () => {
    it("keeps every course's access independent", async () => {
        seed({
            orders: [order("ord-1", "2026-08-20T09:00:00.000Z", "reset-day")],
            offers: [offer("course-reset", 30), offer("course-way21", 90)],
        });

        const reset = await ensureEnrollment(IDENTITY, RESET, NOW);
        const way21 = await ensureEnrollment(IDENTITY, WAY21, NOW);

        expect(reset.enrollment).toMatchObject({ expiresAt: "2026-09-19T09:00:00.000Z" });
        expect(way21).toEqual({ enrollment: null, reason: "not_entitled" });
    });

    it("gives each course the term of its own offer", async () => {
        seed({
            orders: [
                order("ord-1", "2026-08-20T09:00:00.000Z", "reset-day"),
                order("ord-2", "2026-08-20T09:00:00.000Z", "way21"),
            ],
            offers: [offer("course-reset", 30), offer("course-way21", 90)],
        });

        const reset = await ensureEnrollment(IDENTITY, RESET, NOW);
        const way21 = await ensureEnrollment(IDENTITY, WAY21, NOW);

        expect(reset.enrollment).toMatchObject({ expiresAt: "2026-09-19T09:00:00.000Z" });
        expect(way21.enrollment).toMatchObject({ expiresAt: "2026-11-18T09:00:00.000Z" });
    });
});
