/**
 * The deadline gate: what an expired enrollment does at the one door.
 *
 * `lms_enrollments.expires_at` existed from the first migration but nothing
 * read it — a date could be written and access stayed open, which is the worst
 * shape for a gate to be in: the panel says "until the 30th" and the course
 * disagrees. These tests exist so that cannot come back.
 *
 * The course page, the lesson page and every progress write all pass through
 * `ensureEnrollment`, so testing it is testing all three.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { Course } from "@/lms-core";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
    adminClient: () => db,
}));

const { ensureEnrollment } = await import("./server");

const NOW = new Date("2026-08-26T12:00:00Z");

const COURSE = {
    id: "course-reset",
    slug: "reset-day",
    status: "published",
    entitlementProductCodes: ["reset-day"],
} as unknown as Course;

const IDENTITY = { authUserId: "auth-1", email: "learner@example.com", emailVerified: true };

function seed(enrollment: Row | null) {
    db.tables = {
        lms_enrollments: enrollment ? [enrollment] : [],
        platform_users: [{ auth_user_id: "auth-1", email: "learner@example.com", timezone: "Europe/Kyiv" }],
        user_roles: [],
        customers: [{ id: "cus-1", email: "learner@example.com", auth_user_id: "auth-1" }],
        orders: [
            { order_ref: "ord-1", product_code: "reset-day", status: "paid", customer_id: "cus-1", created_at: "2026-08-01T00:00:00Z" },
        ],
        access_tokens: [],
    };
    db.failures = {};
}

const enrollmentRow = (expiresAt: string | null): Row => ({
    id: "enr-1",
    course_id: "course-reset",
    auth_user_id: "auth-1",
    source: "order",
    order_ref: "ord-1",
    started_at: "2026-08-20T00:00:00.000Z",
    expires_at: expiresAt,
});

beforeEach(() => {
    seed(enrollmentRow(null));
});

describe("ensureEnrollment and the deadline", () => {
    it("opens the course while the deadline is ahead, and reports it", async () => {
        seed(enrollmentRow("2026-09-30T23:59:59.999Z"));

        const result = await ensureEnrollment(IDENTITY, COURSE, NOW);
        expect(result.enrollment).toMatchObject({ id: "enr-1", expiresAt: "2026-09-30T23:59:59.999Z" });
    });

    it("closes the course once the deadline has passed", async () => {
        seed(enrollmentRow("2026-08-25T23:59:59.999Z"));

        const result = await ensureEnrollment(IDENTITY, COURSE, NOW);
        expect(result).toEqual({ enrollment: null, reason: "expired" });
    });

    it("keeps the row and its progress — extending the date must return the learner where they stopped", async () => {
        seed(enrollmentRow("2026-08-25T23:59:59.999Z"));
        await ensureEnrollment(IDENTITY, COURSE, NOW);

        expect(db.rows("lms_enrollments")).toHaveLength(1);

        // The same paid learner, after support moved the date.
        (db.rows("lms_enrollments")[0] as Row).expires_at = "2026-12-31T23:59:59.999Z";
        const reopened = await ensureEnrollment(IDENTITY, COURSE, NOW);
        expect(reopened.enrollment).toMatchObject({ id: "enr-1" });
    });

    it("gives a fresh enrollment no deadline — most access does not end", async () => {
        seed(null);

        const result = await ensureEnrollment(IDENTITY, COURSE, NOW);
        expect(result.enrollment).toMatchObject({ source: "order", orderRef: "ord-1", expiresAt: null });
        expect((db.rows("lms_enrollments")[0] as Row).started_at).toBe(NOW.toISOString());
    });
});
