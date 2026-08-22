import { describe, expect, it } from "vitest";
import { isGrantableRole, learnerStatusOf, STALLED_AFTER_DAYS } from "./accessTypes";

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
