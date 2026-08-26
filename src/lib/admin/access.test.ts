/**
 * Access module — what it reads, what it writes, and what it refuses.
 *
 * Runs against `FakeSupabase` rather than a database: every assertion here is
 * about this module's own decisions (which row, which audit entry, which
 * status), not about Postgres.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "./fakeSupabase";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
    adminClient: () => db,
}));

const {
    AccessError,
    createAccount,
    listAccounts,
    grantCourse,
    listCourses,
    listLearners,
    listRoles,
    provisionAccess,
    recordManualPayment,
    blockCourse,
    reactivateCourse,
    revokeCourse,
    unblockCourse,
    sanitizeSearch,
    setCourseAuthor,
    setEnrollmentDeadline,
    setRole,
} = await import("./access");

const NOW = new Date("2026-08-22T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const ADMIN = "auth-admin";

function seed() {
    db.tables = {
        platform_users: [
            { auth_user_id: "auth-1", email: "learner@example.com", full_name: "Learner One", avatar_url: null, last_sign_in_at: daysAgo(1) },
            { auth_user_id: "auth-2", email: "stalled@example.com", full_name: "Stalled Two", avatar_url: null, last_sign_in_at: daysAgo(40) },
            { auth_user_id: "auth-3", email: "fresh@example.com", full_name: "Never Started", avatar_url: null, last_sign_in_at: null },
            { auth_user_id: "auth-coach", email: "coach@example.com", full_name: "Coach", avatar_url: null, last_sign_in_at: daysAgo(2) },
            { auth_user_id: ADMIN, email: "admin@example.com", full_name: "Admin", avatar_url: null, last_sign_in_at: daysAgo(0) },
        ],
        lms_courses: [
            { id: "course-reset", slug: "reset-day", title: "Reset Day", status: "published", locale: "uk", brand: "centerway", author_id: null, updated_at: daysAgo(3) },
            { id: "course-way21", slug: "way21", title: "Way 21", status: "draft", locale: "uk", brand: "centerway", author_id: "auth-coach", updated_at: daysAgo(1) },
        ],
        lms_lessons: [
            { id: "lesson-1", course_id: "course-reset" },
            { id: "lesson-2", course_id: "course-reset" },
        ],
        lms_enrollments: [
            { id: "enr-1", course_id: "course-reset", auth_user_id: "auth-1", source: "order", order_ref: "ord-1", started_at: daysAgo(2), expires_at: null },
            { id: "enr-2", course_id: "course-reset", auth_user_id: "auth-2", source: "manual", order_ref: null, started_at: daysAgo(60), expires_at: null },
            { id: "enr-3", course_id: "course-way21", auth_user_id: "auth-3", source: "manual", order_ref: null, started_at: daysAgo(5), expires_at: null },
        ],
        lms_progress_events: [
            // auth-1: one of two lessons done, active yesterday.
            { id: "ev-1", enrollment_id: "enr-1", client_id: "c1", type: "lesson.started", lesson_id: "lesson-1", payload: {}, occurred_at: daysAgo(2) },
            { id: "ev-2", enrollment_id: "enr-1", client_id: "c2", type: "lesson.completed", lesson_id: "lesson-1", payload: {}, occurred_at: daysAgo(1) },
            // auth-2: started long ago and went silent.
            { id: "ev-3", enrollment_id: "enr-2", client_id: "c3", type: "lesson.started", lesson_id: "lesson-1", payload: {}, occurred_at: daysAgo(50) },
        ],
        user_roles: [
            { user_id: ADMIN, role: "admin", updated_at: daysAgo(30) },
            { user_id: "auth-coach", role: "coach", updated_at: daysAgo(10) },
            { user_id: "auth-1", role: "user", updated_at: daysAgo(5) },
        ],
        customers: [
            { id: "cus-1", email: "learner@example.com", auth_user_id: null, created_at: daysAgo(70) },
        ],
        orders: [],
        audit_log: [],
    };
    db.failures = {};
    db.authUsers = [];
    db.authCreateError = null;
}

const auditRows = () => db.rows("audit_log");

beforeEach(() => {
    seed();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

describe("listLearners", () => {
    it("folds the event log into per-learner progress and a status", async () => {
        const { items, total, summary } = await listLearners({ limit: 50, offset: 0 });

        // Three people, each holding one course.
        expect(total).toBe(3);
        const byEmail = new Map(items.map((row) => [row.email, row]));

        expect(byEmail.get("learner@example.com")).toMatchObject({
            lessonsTotal: 2,
            lessonsCompleted: 1,
            status: "in_progress",
        });
        expect(byEmail.get("learner@example.com")!.courses[0]).toMatchObject({
            courseSlug: "reset-day",
            source: "order",
        });
        expect(byEmail.get("stalled@example.com")).toMatchObject({ lessonsCompleted: 0, status: "stalled" });
        expect(byEmail.get("fresh@example.com")).toMatchObject({ lastActivityAt: null, status: "not_started" });

        expect(summary).toEqual({ not_started: 1, in_progress: 1, stalled: 1, completed: 0 });
    });

    it("counts a course with no lessons as 0 of 0 rather than finished", async () => {
        // course-way21 has no lms_lessons rows at all.
        const { items } = await listLearners({ courseSlug: "way21", limit: 50, offset: 0 });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ lessonsTotal: 0, status: "not_started" });
    });

    it("filters by course and rejects a slug that does not exist", async () => {
        const { items } = await listLearners({ courseSlug: "reset-day", limit: 50, offset: 0 });
        expect(items.map((row) => row.email)).toEqual(
            expect.arrayContaining(["learner@example.com", "stalled@example.com"])
        );
        expect(items).toHaveLength(2);

        await expect(listLearners({ courseSlug: "nope", limit: 50, offset: 0 })).rejects.toMatchObject({
            message: "course_not_found",
            status: 404,
        });
    });

    it("searches accounts by email and by name", async () => {
        const byEmail = await listLearners({ q: "stalled@", limit: 50, offset: 0 });
        expect(byEmail.items.map((row) => row.email)).toEqual(["stalled@example.com"]);

        const byName = await listLearners({ q: "Learner", limit: 50, offset: 0 });
        expect(byName.items.map((row) => row.email)).toEqual(["learner@example.com"]);
    });

    it("returns an empty page — not everyone — when the search matches nobody", async () => {
        const result = await listLearners({ q: "nobody-here", limit: 50, offset: 0 });
        expect(result).toMatchObject({ items: [], total: 0, truncated: false });
    });

    it("filters by status after folding, and paginates the filtered set", async () => {
        const stalled = await listLearners({ status: "stalled", limit: 50, offset: 0 });
        expect(stalled.total).toBe(1);
        expect(stalled.items[0].email).toBe("stalled@example.com");
        // The summary still describes the whole set, not the filtered slice.
        expect(stalled.summary.in_progress).toBe(1);

        const firstPage = await listLearners({ limit: 2, offset: 0 });
        const secondPage = await listLearners({ limit: 2, offset: 2 });
        expect(firstPage.items).toHaveLength(2);
        expect(secondPage.items).toHaveLength(1);
        expect(firstPage.total).toBe(3);
    });

    it("keeps a learner visible when their course row is missing", async () => {
        db.tables.lms_enrollments.push({
            id: "enr-orphan", course_id: "course-gone", auth_user_id: "auth-1",
            source: "manual", order_ref: null, started_at: daysAgo(1), expires_at: null,
        });
        const { items } = await listLearners({ limit: 50, offset: 0 });
        const orphan = items
            .flatMap((account) => account.courses)
            .find((row) => row.enrollmentId === "enr-orphan");
        expect(orphan).toMatchObject({ courseSlug: "—", lessonsTotal: 0 });
    });

    it("gives one person one row, however many courses they hold", async () => {
        db.tables.lms_enrollments.push({
            id: "enr-4", course_id: "course-way21", auth_user_id: "auth-1",
            source: "manual", order_ref: null, started_at: daysAgo(1), expires_at: null,
        });

        const { items, total, summary } = await listLearners({ limit: 50, offset: 0 });

        // Still three people, not four rows.
        expect(total).toBe(3);
        const learner = items.find((row) => row.email === "learner@example.com")!;
        expect(learner.courses.map((course) => course.courseSlug).sort()).toEqual(["reset-day", "way21"]);
        // Lessons add up across their courses; way21 has none yet.
        expect(learner).toMatchObject({ lessonsTotal: 2, lessonsCompleted: 1, status: "in_progress" });

        // The tiles count people per status they hold, so this one person is
        // counted under both of theirs — and the numbers no longer sum to 3.
        expect(summary).toMatchObject({ in_progress: 1, not_started: 2, stalled: 1 });
    });

    it("matches a person when any one of their courses is in the filtered status", async () => {
        db.tables.lms_enrollments.push({
            id: "enr-4", course_id: "course-way21", auth_user_id: "auth-1",
            source: "manual", order_ref: null, started_at: daysAgo(1), expires_at: null,
        });

        const idle = await listLearners({ status: "not_started", limit: 50, offset: 0 });
        // auth-1 qualifies through way21 even though reset-day is in progress.
        expect(idle.items.map((row) => row.email).sort()).toEqual([
            "fresh@example.com",
            "learner@example.com",
        ]);
    });

    it("surfaces a database error as a 500 instead of an empty list", async () => {
        db.failures["lms_courses:select"] = "boom";
        await expect(listLearners({ limit: 50, offset: 0 })).rejects.toMatchObject({ status: 500 });
    });
});

describe("sanitizeSearch", () => {
    it("strips the characters that would rewrite a PostgREST or() filter", () => {
        // Without this, the comma would end the ilike clause and the rest would
        // be parsed as a second filter.
        expect(sanitizeSearch("a,b(c)*d")).toBe("a b c  d");
        expect(sanitizeSearch("  spaced@example.com  ")).toBe("spaced@example.com");
        expect(sanitizeSearch(undefined)).toBe("");
    });
});

describe("grantCourse", () => {
    it("creates a manual enrollment and records who granted it", async () => {
        const result = await grantCourse({ email: "fresh@example.com", courseSlug: "reset-day", actorId: ADMIN });

        expect(result.created).toBe(true);
        const enrollment = db.rows("lms_enrollments").find((row) => row.id === result.enrollmentId) as Row;
        expect(enrollment).toMatchObject({
            course_id: "course-reset",
            auth_user_id: "auth-3",
            source: "manual",
            started_at: NOW.toISOString(),
        });

        expect(auditRows()).toHaveLength(1);
        expect(auditRows()[0]).toMatchObject({
            actor_id: ADMIN,
            action: "access.course.grant",
            entity_type: "lms_enrollment",
            entity_id: result.enrollmentId,
        });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({
            course_slug: "reset-day",
            grantee_email: "fresh@example.com",
        });
    });

    it("matches the account case-insensitively", async () => {
        const result = await grantCourse({ email: "FRESH@Example.com", courseSlug: "reset-day", actorId: ADMIN });
        expect(result.created).toBe(true);
        expect(result.account.authUserId).toBe("auth-3");
    });

    it("is a no-op when the access already exists, and writes no audit entry", async () => {
        const result = await grantCourse({ email: "learner@example.com", courseSlug: "reset-day", actorId: ADMIN });
        expect(result).toMatchObject({ created: false, enrollmentId: "enr-1" });
        expect(db.rows("lms_enrollments")).toHaveLength(3);
        expect(auditRows()).toHaveLength(0);
    });

    it("refuses an account that has never signed in", async () => {
        await expect(
            grantCourse({ email: "ghost@example.com", courseSlug: "reset-day", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "account_not_found", status: 400 });
        expect(db.rows("lms_enrollments")).toHaveLength(3);
    });

    it("refuses an unknown course", async () => {
        await expect(
            grantCourse({ email: "fresh@example.com", courseSlug: "nope", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "course_not_found", status: 404 });
    });

    it("grants a draft course too — a manual grant is itself the permission to preview", async () => {
        const result = await grantCourse({ email: "learner@example.com", courseSlug: "way21", actorId: ADMIN });
        expect(result.created).toBe(true);
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({ course_status: "draft" });
    });
});

describe("listAccounts", () => {
    it("lists everyone with an account, including people no other tab can show", async () => {
        const { items, total } = await listAccounts({ limit: 50, offset: 0 });

        // Five accounts are seeded; only two hold an elevated role and only
        // three hold a course, which is exactly why this list has to exist.
        expect(total).toBe(5);
        const emails = items.map((row) => row.email);
        expect(emails).toContain("fresh@example.com");
        expect(emails).toContain("coach@example.com");
    });

    it("carries the role, the course count and the purchase count", async () => {
        db.tables.orders.push(
            { order_ref: "ord-a", product_code: "reset-day", status: "paid", customer_id: "cus-1", created_at: daysAgo(9) },
            // Not paid: an abandoned checkout is not a purchase.
            { order_ref: "ord-b", product_code: "reset-day", status: "created", customer_id: "cus-1", created_at: daysAgo(8) }
        );

        const { items } = await listAccounts({ limit: 50, offset: 0 });
        const byEmail = new Map(items.map((row) => [row.email, row]));

        expect(byEmail.get("learner@example.com")).toMatchObject({
            role: "user",
            enrollments: 1,
            purchases: 1,
        });
        expect(byEmail.get("coach@example.com")).toMatchObject({ role: "coach", enrollments: 0, purchases: 0 });
        // No `user_roles` row at all — most people — reads as null, not as a
        // missing account.
        expect(byEmail.get("fresh@example.com")).toMatchObject({ role: null, enrollments: 1 });
    });

    it("counts a purchase made before the account existed, matched by email", async () => {
        // `customers.auth_user_id` is NULL until the buyer signs in; counting
        // only linked rows would report 0 for the very people support looks up.
        db.tables.customers.push({ id: "cus-2", email: "fresh@example.com", auth_user_id: null, created_at: daysAgo(20) });
        db.tables.orders.push({ order_ref: "ord-c", product_code: "way21", status: "paid", customer_id: "cus-2", created_at: daysAgo(19) });

        const { items } = await listAccounts({ limit: 50, offset: 0 });
        expect(items.find((row) => row.email === "fresh@example.com")).toMatchObject({ purchases: 1 });
    });

    it("leaves a customer row that belongs to another account alone", async () => {
        db.tables.customers.push({ id: "cus-3", email: "fresh@example.com", auth_user_id: "auth-someone-else", created_at: daysAgo(20) });
        db.tables.orders.push({ order_ref: "ord-d", product_code: "way21", status: "paid", customer_id: "cus-3", created_at: daysAgo(19) });

        const { items } = await listAccounts({ limit: 50, offset: 0 });
        expect(items.find((row) => row.email === "fresh@example.com")).toMatchObject({ purchases: 0 });
    });

    it("searches by email and by name, and reports the full count for paging", async () => {
        const byEmail = await listAccounts({ q: "coach@", limit: 50, offset: 0 });
        expect(byEmail.items.map((row) => row.email)).toEqual(["coach@example.com"]);

        const byName = await listAccounts({ q: "Never Started", limit: 50, offset: 0 });
        expect(byName.items.map((row) => row.email)).toEqual(["fresh@example.com"]);

        const firstPage = await listAccounts({ limit: 2, offset: 0 });
        expect(firstPage.items).toHaveLength(2);
        expect(firstPage.total).toBe(5);
    });

    it("returns an empty page rather than everyone when nothing matches", async () => {
        expect(await listAccounts({ q: "nobody-here", limit: 50, offset: 0 })).toEqual({ items: [], total: 0 });
    });
});

describe("setEnrollmentDeadline", () => {
    it("writes the deadline and records both ends of the change", async () => {
        const result = await setEnrollmentDeadline({
            enrollmentId: "enr-1",
            expiresAt: "2026-09-30T23:59:59.999Z",
            actorId: ADMIN,
        });

        expect(result).toMatchObject({ courseSlug: "reset-day", email: "learner@example.com" });
        const enrollment = db.rows("lms_enrollments").find((row) => row.id === "enr-1") as Row;
        expect(enrollment.expires_at).toBe("2026-09-30T23:59:59.999Z");

        expect(auditRows()[0]).toMatchObject({ action: "access.course.deadline", entity_id: "enr-1" });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({
            expires_at_before: null,
            expires_at_after: "2026-09-30T23:59:59.999Z",
        });
    });

    it("clears a deadline without touching the progress the learner already has", async () => {
        await setEnrollmentDeadline({ enrollmentId: "enr-1", expiresAt: "2026-09-01T00:00:00.000Z", actorId: ADMIN });
        await setEnrollmentDeadline({ enrollmentId: "enr-1", expiresAt: null, actorId: ADMIN });

        expect((db.rows("lms_enrollments").find((row) => row.id === "enr-1") as Row).expires_at).toBeNull();
        expect(db.rows("lms_progress_events").filter((row) => row.enrollment_id === "enr-1")).toHaveLength(2);
        expect((auditRows()[1] as { metadata: Row }).metadata).toMatchObject({
            expires_at_before: "2026-09-01T00:00:00.000Z",
            expires_at_after: null,
        });
    });

    it("refuses an enrollment that is not there", async () => {
        await expect(
            setEnrollmentDeadline({ enrollmentId: "enr-gone", expiresAt: null, actorId: ADMIN })
        ).rejects.toMatchObject({ message: "enrollment_not_found", status: 404 });
    });
});

describe("createAccount", () => {
    it("mints an account for an email that has never signed in, with the address confirmed", async () => {
        const result = await createAccount({ email: "New@Example.com", fullName: " Ann ", actorId: ADMIN });

        expect(result.created).toBe(true);
        // Confirmed, because purchase linking matches by email ONLY when the
        // provider verified it — an unconfirmed account would own nothing.
        expect(db.authUsers[0]).toMatchObject({ email: "new@example.com", emailConfirmed: true });

        const profile = db.rows("platform_users").find((row) => row.email === "new@example.com") as Row;
        expect(profile).toMatchObject({ auth_user_id: result.account.authUserId, full_name: "Ann", provider: "manual" });
        expect(auditRows()[0]).toMatchObject({ action: "access.account.create" });
    });

    it("leaves an existing account alone rather than making a second one", async () => {
        const result = await createAccount({ email: "LEARNER@example.com", actorId: ADMIN });

        expect(result).toMatchObject({ created: false });
        expect(result.account.authUserId).toBe("auth-1");
        expect(db.authUsers).toHaveLength(0);
        expect(auditRows()).toHaveLength(0);
    });

    it("surfaces a failure from the auth API instead of writing a profile for nobody", async () => {
        db.authCreateError = "email address already registered";
        await expect(createAccount({ email: "new@example.com", actorId: ADMIN })).rejects.toMatchObject({ status: 500 });
        expect(db.rows("platform_users").some((row) => row.email === "new@example.com")).toBe(false);
    });
});

describe("recordManualPayment", () => {
    it("writes a paid order against the buyer's customer row and marks it manual", async () => {
        const result = await recordManualPayment({
            email: "learner@example.com",
            productCode: "course:reset-day",
            amount: 1200,
            currency: "UAH",
            note: "bank transfer",
            authUserId: "auth-1",
            actorId: ADMIN,
        });

        expect(result.orderRef.startsWith("manual_course-reset-day_")).toBe(true);
        const order = db.rows("orders")[0];
        expect(order).toMatchObject({
            order_ref: result.orderRef,
            product_code: "course:reset-day",
            amount: 1200,
            currency: "UAH",
            status: "paid",
            customer_id: "cus-1",
        });

        // The customer row existed but belonged to nobody; linking it is what
        // makes the purchase visible to the LMS and the profile.
        expect((db.rows("customers")[0] as Row).auth_user_id).toBe("auth-1");
        expect(auditRows()[0]).toMatchObject({ action: "order.manual.record", entity_id: result.orderRef });
    });

    it("creates the customer row when this email has never bought anything", async () => {
        await recordManualPayment({
            email: "fresh@example.com",
            productCode: "course:way21",
            amount: 500,
            currency: "USD",
            authUserId: "auth-3",
            actorId: ADMIN,
        });

        const customer = db.rows("customers").find((row) => row.email === "fresh@example.com") as Row;
        expect(customer).toMatchObject({ auth_user_id: "auth-3" });
    });

    it("never re-points a customer row that already belongs to someone else", async () => {
        (db.rows("customers")[0] as Row).auth_user_id = "auth-someone-else";

        await recordManualPayment({
            email: "learner@example.com",
            productCode: "course:reset-day",
            amount: 100,
            currency: "UAH",
            authUserId: "auth-1",
            actorId: ADMIN,
        });

        expect((db.rows("customers")[0] as Row).auth_user_id).toBe("auth-someone-else");
    });

    it("refuses an amount that is not money", async () => {
        for (const amount of [0, -5, Number.NaN]) {
            await expect(
                recordManualPayment({
                    email: "learner@example.com",
                    productCode: "course:reset-day",
                    amount,
                    currency: "UAH",
                    actorId: ADMIN,
                })
            ).rejects.toMatchObject({ message: "amount_invalid" });
        }
        expect(db.rows("orders")).toHaveLength(0);
    });
});

describe("provisionAccess", () => {
    it("makes the account, records the money, then opens the course — in that order", async () => {
        const result = await provisionAccess({
            email: "buyer@example.com",
            fullName: "Buyer",
            courseSlug: "reset-day",
            expiresAt: "2026-09-30T23:59:59.999Z",
            createAccount: true,
            payment: { amount: 1200, currency: "UAH", note: "cash" },
            actorId: ADMIN,
        });

        expect(result.accountCreated).toBe(true);
        expect(result.payment?.orderRef).toBeTruthy();
        expect(result.grant.created).toBe(true);

        const enrollment = db.rows("lms_enrollments").find((row) => row.id === result.grant.enrollmentId) as Row;
        expect(enrollment).toMatchObject({ source: "manual", expires_at: "2026-09-30T23:59:59.999Z" });

        // The order is charged under the course's own offer code, which
        // `resolveEntitlement` always accepts — so the buyer owns the course by
        // purchase, not only by the operator's word.
        expect((db.rows("orders")[0] as Row).product_code).toBe("course:reset-day");
        // The customer row is linked to the new account, so entitlement finds it.
        const customer = db.rows("customers").find((row) => row.email === "buyer@example.com") as Row;
        expect(customer.auth_user_id).toBe(result.account.authUserId);
    });

    it("grants without money when there was none — a gift or a review copy", async () => {
        const result = await provisionAccess({
            email: "fresh@example.com",
            courseSlug: "reset-day",
            actorId: ADMIN,
        });

        expect(result).toMatchObject({ accountCreated: false, payment: null });
        expect(db.rows("orders")).toHaveLength(0);
    });

    it("applies a deadline typed for someone who is already enrolled", async () => {
        const result = await provisionAccess({
            email: "learner@example.com",
            courseSlug: "reset-day",
            expiresAt: "2026-10-15T23:59:59.999Z",
            actorId: ADMIN,
        });

        // Enrolment unchanged, but half the request — "until this date" — was
        // not yet true, so it is applied rather than silently dropped.
        expect(result.grant.created).toBe(false);
        expect((db.rows("lms_enrollments").find((row) => row.id === "enr-1") as Row).expires_at).toBe(
            "2026-10-15T23:59:59.999Z"
        );
    });

    it("refuses an unknown account before writing an order for it", async () => {
        await expect(
            provisionAccess({
                email: "ghost@example.com",
                courseSlug: "reset-day",
                payment: { amount: 900, currency: "UAH" },
                actorId: ADMIN,
            })
        ).rejects.toMatchObject({ message: "account_not_found" });
        expect(db.rows("orders")).toHaveLength(0);
    });

    it("refuses an unknown course before writing an order for it", async () => {
        // The failure `grantCourse` would hit anyway — checked here, before the
        // sale, so a typo'd slug never leaves a charge with nothing behind it.
        await expect(
            provisionAccess({
                email: "learner@example.com",
                courseSlug: "no-such-course",
                payment: { amount: 900, currency: "UAH" },
                actorId: ADMIN,
            })
        ).rejects.toMatchObject({ message: "course_not_found" });
        expect(db.rows("orders")).toHaveLength(0);
    });

    it("refuses a banned seat before writing an order for it", async () => {
        db.tables.lms_enrollments = [
            ...db.rows("lms_enrollments"),
            { id: "enr-blocked", course_id: "course-reset", auth_user_id: "auth-3", source: "manual", order_ref: null, started_at: daysAgo(10), expires_at: null, blocked_at: daysAgo(1) },
        ];

        // Same reasoning as the unknown-course case: a ban is a known, checkable
        // reason `grantCourse` would refuse this grant, so it is caught before
        // the money is written rather than after — a retry from the operator
        // must not record a second charge for a seat that still won't open.
        await expect(
            provisionAccess({
                email: "fresh@example.com",
                courseSlug: "reset-day",
                payment: { amount: 900, currency: "UAH" },
                actorId: ADMIN,
            })
        ).rejects.toMatchObject({ message: "enrollment_blocked" });
        expect(db.rows("orders")).toHaveLength(0);
    });
});

describe("revokeCourse", () => {
    /* WHY THE ROW SURVIVES. Deleting it destroyed the learner's progress AND
       undid the revoke: entitlement is derived from paid orders, which stay, so
       the next visit re-created the enrollment. The status is what the door
       reads now, and it outranks the purchase that paid for it. */
    it("closes the seat without deleting it or the progress behind it", async () => {
        const result = await revokeCourse({ enrollmentId: "enr-1", actorId: ADMIN });

        expect(result).toMatchObject({
            courseSlug: "reset-day",
            email: "learner@example.com",
            status: "revoked",
        });

        const row = db.rows("lms_enrollments").find((item) => item.id === "enr-1");
        expect(row?.status).toBe("revoked");
        expect(row?.revoked_at).toEqual(expect.any(String));
        expect(db.rows("lms_progress_events").filter((item) => item.enrollment_id === "enr-1")).toHaveLength(2);
        expect(auditRows()[0]).toMatchObject({ action: "access.course.revoke", entity_id: "enr-1" });
    });

    it("is lifted by reactivation, and the progress is still there", async () => {
        await revokeCourse({ enrollmentId: "enr-1", actorId: ADMIN });
        const result = await reactivateCourse({ enrollmentId: "enr-1", actorId: ADMIN });

        expect(result).toMatchObject({ courseSlug: "reset-day", status: "active" });
        const row = db.rows("lms_enrollments").find((item) => item.id === "enr-1");
        expect(row?.status).toBe("active");
        expect(row?.revoked_at).toBeNull();
        expect(db.rows("lms_progress_events").filter((item) => item.enrollment_id === "enr-1")).toHaveLength(2);
    });

    /* A ban is the state a payment cannot argue with, so it is also the state a
       grant cannot silently overwrite. */
    it("refuses to reactivate or re-grant a banned seat", async () => {
        await blockCourse({ enrollmentId: "enr-1", actorId: ADMIN, reason: "chargeback" });

        await expect(reactivateCourse({ enrollmentId: "enr-1", actorId: ADMIN })).rejects.toMatchObject({
            message: "enrollment_blocked",
            status: 409,
        });
        await expect(
            grantCourse({ email: "learner@example.com", courseSlug: "reset-day", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "enrollment_blocked" });

        await unblockCourse({ enrollmentId: "enr-1", actorId: ADMIN });
        const row = db.rows("lms_enrollments").find((item) => item.id === "enr-1");
        expect(row?.blocked_at).toBeNull();
    });

    it("refuses an enrollment that is not there", async () => {
        await expect(revokeCourse({ enrollmentId: "enr-gone", actorId: ADMIN })).rejects.toMatchObject({
            message: "enrollment_not_found",
            status: 404,
        });
        expect(auditRows()).toHaveLength(0);
    });
});

describe("setRole", () => {
    it("writes user_roles and audits the before/after", async () => {
        const result = await setRole({ email: "learner@example.com", role: "support", actorId: ADMIN });

        expect(result).toMatchObject({ previous: "user", role: "support" });
        const stored = db.rows("user_roles").find((row) => row.user_id === "auth-1");
        expect(stored).toMatchObject({ role: "support" });
        // Upsert, not insert: the account keeps one row.
        expect(db.rows("user_roles").filter((row) => row.user_id === "auth-1")).toHaveLength(1);

        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({
            grantee_email: "learner@example.com",
            role_before: "user",
            role_after: "support",
        });
    });

    it("creates the row for an account that has no role yet", async () => {
        await setRole({ email: "fresh@example.com", role: "coach", actorId: ADMIN });
        expect(db.rows("user_roles").find((row) => row.user_id === "auth-3")).toMatchObject({ role: "coach" });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({ role_before: null });
    });

    it("refuses to change the actor's own role — that is how a panel locks itself out", async () => {
        await expect(setRole({ email: "admin@example.com", role: "user", actorId: ADMIN })).rejects.toMatchObject({
            message: "cannot_change_own_role",
            status: 409,
        });
        expect(db.rows("user_roles").find((row) => row.user_id === ADMIN)).toMatchObject({ role: "admin" });
        expect(auditRows()).toHaveLength(0);
    });

    it("refuses an account that has never signed in", async () => {
        await expect(
            setRole({ email: "ghost@example.com", role: "admin", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "account_not_found" });
    });
});

describe("listRoles", () => {
    it("lists elevated accounts only, with what each one holds", async () => {
        const rows = await listRoles({});

        expect(rows.map((row) => row.email)).toEqual(
            expect.arrayContaining(["admin@example.com", "coach@example.com"])
        );
        // auth-1 is a plain 'user' — everyone is, so it is not a role listing.
        expect(rows.some((row) => row.email === "learner@example.com")).toBe(false);

        const coach = rows.find((row) => row.email === "coach@example.com");
        expect(coach).toMatchObject({ role: "coach", ownedCourses: 1, enrollments: 0 });
    });

    it("filters by email or name", async () => {
        expect((await listRoles({ q: "coach" })).map((row) => row.email)).toEqual(["coach@example.com"]);
        expect(await listRoles({ q: "nobody" })).toEqual([]);
    });

    it("returns nothing — without querying for a sentinel id — when no one is elevated", async () => {
        db.tables.user_roles = [{ user_id: "auth-1", role: "user", updated_at: daysAgo(1) }];
        expect(await listRoles({})).toEqual([]);
    });

    it("normalises legacy capitalised roles", async () => {
        db.tables.user_roles = [{ user_id: "auth-1", role: "Admin", updated_at: daysAgo(1) }];
        expect((await listRoles({}))[0]).toMatchObject({ role: "admin" });
    });
});

describe("listCourses", () => {
    it("resolves the author and counts learners per course", async () => {
        const rows = await listCourses();
        const reset = rows.find((row) => row.slug === "reset-day");
        const way21 = rows.find((row) => row.slug === "way21");

        expect(reset).toMatchObject({ authorId: null, authorEmail: null, learners: 2 });
        expect(way21).toMatchObject({ authorId: "auth-coach", authorEmail: "coach@example.com", learners: 1 });
    });
});

describe("setCourseAuthor", () => {
    it("hands a course to an author and audits both sides of the change", async () => {
        await setCourseAuthor({ courseId: "course-reset", email: "coach@example.com", actorId: ADMIN });

        expect(db.rows("lms_courses").find((row) => row.id === "course-reset")).toMatchObject({ author_id: "auth-coach" });
        expect(auditRows()[0]).toMatchObject({ action: "access.course.author_set", entity_id: "course-reset" });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({
            author_before: null,
            author_after: "auth-coach",
            author_email: "coach@example.com",
        });
    });

    it("returns a course to the house when the email is empty", async () => {
        await setCourseAuthor({ courseId: "course-way21", email: null, actorId: ADMIN });

        expect(db.rows("lms_courses").find((row) => row.id === "course-way21")).toMatchObject({ author_id: null });
        expect(auditRows()[0]).toMatchObject({ action: "access.course.author_cleared" });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({ author_before: "auth-coach", author_after: null });
    });

    it("refuses an unknown course and an unknown author, changing nothing", async () => {
        await expect(
            setCourseAuthor({ courseId: "course-gone", email: "coach@example.com", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "course_not_found", status: 404 });

        await expect(
            setCourseAuthor({ courseId: "course-reset", email: "ghost@example.com", actorId: ADMIN })
        ).rejects.toMatchObject({ message: "account_not_found" });

        expect(db.rows("lms_courses").find((row) => row.id === "course-reset")).toMatchObject({ author_id: null });
        expect(auditRows()).toHaveLength(0);
    });
});

describe("AccessError", () => {
    it("defaults to 400 so a bad input never reads as a server fault", () => {
        expect(new AccessError("nope").status).toBe(400);
    });
});
