import { describe, expect, it } from "vitest";
import {
    deadlineInputValue,
    groupLearnersByAccount,
    isGrantableRole,
    isPaymentCurrency,
    learnerStatusOf,
    normalizeDeadline,
    STALLED_AFTER_DAYS,
} from "./accessTypes";
import type { LearnerRow, LearnerStatus } from "./accessTypes";

const NOW = new Date("2026-08-22T12:00:00Z").getTime();
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe("learnerStatusOf", () => {
    it("calls an enrollment with no events not started, however old it is", () => {
        expect(learnerStatusOf(7, 0, null, NOW)).toBe("not_started");
    });

    it("counts a learner who opened a lesson today as in progress", () => {
        expect(learnerStatusOf(7, 1, daysAgo(0), NOW)).toBe("in_progress");
    });

    it("calls a silent learner stalled only after the threshold", () => {
        expect(learnerStatusOf(7, 1, daysAgo(STALLED_AFTER_DAYS - 1), NOW)).toBe("in_progress");
        expect(learnerStatusOf(7, 1, daysAgo(STALLED_AFTER_DAYS + 1), NOW)).toBe("stalled");
    });

    it("prefers completed over stalled — a finished course is not neglected", () => {
        expect(learnerStatusOf(7, 7, daysAgo(90), NOW)).toBe("completed");
    });

    it("never calls a course with no lessons completed", () => {
        // A course whose lessons are not written yet would otherwise read as
        // "0 of 0 done", i.e. finished by everyone who opened it.
        expect(learnerStatusOf(0, 0, daysAgo(1), NOW)).toBe("in_progress");
    });
});

describe("isGrantableRole", () => {
    it("accepts exactly what user_roles' CHECK accepts", () => {
        for (const role of ["user", "coach", "support", "admin"]) {
            expect(isGrantableRole(role)).toBe(true);
        }
    });

    it("rejects anything else, including casing the DB would refuse", () => {
        expect(isGrantableRole("Admin")).toBe(false);
        expect(isGrantableRole("owner")).toBe(false);
        expect(isGrantableRole(null)).toBe(false);
    });
});

describe("groupLearnersByAccount", () => {
    const enrollment = (
        authUserId: string,
        courseSlug: string,
        status: LearnerStatus,
        extra: Partial<LearnerRow> = {}
    ): LearnerRow => ({
        enrollmentId: `${authUserId}-${courseSlug}`,
        courseId: courseSlug,
        courseSlug,
        courseTitle: courseSlug,
        courseStatus: "published",
        authUserId,
        email: `${authUserId}@example.com`,
        fullName: null,
        avatarUrl: null,
        source: "manual",
        orderRef: null,
        startedAt: "2026-08-01T00:00:00.000Z",
        expiresAt: null,
        lessonsTotal: 0,
        lessonsCompleted: 0,
        lastActivityAt: null,
        status,
        ...extra,
    });

    it("puts each person on one row and keeps input order", () => {
        const rows = groupLearnersByAccount([
            enrollment("b", "way21", "in_progress"),
            enrollment("a", "reset-day", "not_started"),
            enrollment("b", "reset-day", "not_started"),
        ]);

        expect(rows.map((row) => row.authUserId)).toEqual(["b", "a"]);
        expect(rows[0].courses.map((course) => course.courseSlug)).toEqual(["way21", "reset-day"]);
    });

    it("adds up lessons and takes the newest activity across courses", () => {
        const [row] = groupLearnersByAccount([
            enrollment("a", "reset-day", "in_progress", {
                lessonsTotal: 5, lessonsCompleted: 2, lastActivityAt: "2026-08-10T00:00:00.000Z",
            }),
            enrollment("a", "way21", "completed", {
                lessonsTotal: 3, lessonsCompleted: 3, lastActivityAt: "2026-08-20T00:00:00.000Z",
            }),
        ]);

        expect(row).toMatchObject({
            lessonsTotal: 8,
            lessonsCompleted: 5,
            lastActivityAt: "2026-08-20T00:00:00.000Z",
        });
    });

    it("headlines the course that needs a look, not the finished one", () => {
        const stalled = groupLearnersByAccount([
            enrollment("a", "way21", "completed"),
            enrollment("a", "reset-day", "stalled"),
        ]);
        expect(stalled[0].status).toBe("stalled");

        const working = groupLearnersByAccount([
            enrollment("a", "way21", "completed"),
            enrollment("a", "reset-day", "in_progress"),
        ]);
        expect(working[0].status).toBe("in_progress");

        const done = groupLearnersByAccount([enrollment("a", "way21", "completed")]);
        expect(done[0].status).toBe("completed");
    });
});

describe("normalizeDeadline", () => {
    it("reads a bare date as the END of that day", () => {
        // "access until the 30th" has to include the 30th; midnight would take
        // the day away from someone the operator meant to give it to.
        expect(normalizeDeadline("2026-09-30")).toEqual({ ok: true, value: "2026-09-30T23:59:59.999Z" });
    });

    it("treats an empty value as no deadline, which is how the UI clears one", () => {
        expect(normalizeDeadline("")).toEqual({ ok: true, value: null });
        expect(normalizeDeadline("   ")).toEqual({ ok: true, value: null });
        expect(normalizeDeadline(null)).toEqual({ ok: true, value: null });
        expect(normalizeDeadline(undefined)).toEqual({ ok: true, value: null });
    });

    it("keeps a full instant as it is", () => {
        expect(normalizeDeadline("2026-09-30T10:00:00.000Z")).toEqual({
            ok: true,
            value: "2026-09-30T10:00:00.000Z",
        });
    });

    it("refuses what it cannot read rather than guessing a date", () => {
        expect(normalizeDeadline("soon")).toEqual({ ok: false });
        expect(normalizeDeadline("2026-13-45")).toEqual({ ok: false });
        expect(normalizeDeadline(1759190400000)).toEqual({ ok: false });
    });

    it("round-trips through the date input it was typed in", () => {
        const stored = normalizeDeadline("2026-09-30");
        expect(stored.ok && deadlineInputValue(stored.value)).toBe("2026-09-30");
        expect(deadlineInputValue(null)).toBe("");
        expect(deadlineInputValue("not-a-date")).toBe("");
    });
});

describe("isPaymentCurrency", () => {
    it("accepts only what the panel offers", () => {
        expect(isPaymentCurrency("UAH")).toBe(true);
        expect(isPaymentCurrency("uah")).toBe(false);
        expect(isPaymentCurrency("BTC")).toBe(false);
        expect(isPaymentCurrency(980)).toBe(false);
    });
});
