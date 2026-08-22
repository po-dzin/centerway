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
    grantCourse,
    listCourses,
    listLearners,
    listRoles,
    revokeCourse,
    sanitizeSearch,
    setCourseAuthor,
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
        audit_log: [],
    };
    db.failures = {};
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

        expect(total).toBe(3);
        const byEmail = new Map(items.map((row) => [row.email, row]));

        expect(byEmail.get("learner@example.com")).toMatchObject({
            courseSlug: "reset-day",
            lessonsTotal: 2,
            lessonsCompleted: 1,
            status: "in_progress",
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
        const orphan = items.find((row) => row.enrollmentId === "enr-orphan");
        expect(orphan).toMatchObject({ courseSlug: "—", lessonsTotal: 0 });
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

describe("revokeCourse", () => {
    it("deletes the enrollment and records how much progress went with it", async () => {
        const result = await revokeCourse({ enrollmentId: "enr-1", actorId: ADMIN });

        expect(result).toMatchObject({
            courseSlug: "reset-day",
            email: "learner@example.com",
            progressEventsDeleted: 2,
        });
        expect(db.rows("lms_enrollments").some((row) => row.id === "enr-1")).toBe(false);
        expect(auditRows()[0]).toMatchObject({ action: "access.course.revoke", entity_id: "enr-1" });
        expect((auditRows()[0] as { metadata: Row }).metadata).toMatchObject({ progress_events_deleted: 2 });
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
