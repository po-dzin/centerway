import { describe, expect, it } from "vitest";

import { daysRemaining, isEnrollmentExpired } from "@/lms-core/access";

import { grantDeadlineValue, normalizeDeadline } from "./accessTypes";

/**
 * The grant panel's perpetual checkbox, checked against the API it posts to
 * rather than against itself — `grantDeadlineValue` is the function the panel
 * actually calls, and `normalizeDeadline` is what the route runs on the result.
 *
 * Three answers, not two, since 2026-08-28: ticked is an explicit override to
 * forever; a typed date is the other explicit override; unticked with nothing
 * typed sends nothing at all, so the module fills the term in from the
 * course's own offer instead of defaulting to forever.
 */
describe("grant deadline: the perpetual checkbox", () => {
    const now = new Date("2026-08-28T12:00:00Z");

    it("means perpetual whatever the dimmed date still holds", () => {
        expect(grantDeadlineValue(true, "")).toBeNull();
        expect(grantDeadlineValue(true, "2026-12-31")).toBeNull();
    });

    it("sends the typed date once unticked", () => {
        expect(grantDeadlineValue(false, "2026-12-31")).toBe("2026-12-31");
    });

    it("sends nothing unticked with nothing typed, so the offer's own term applies", () => {
        // Until 2026-08-28 this was `null` — "perpetual" — which meant a
        // hand-recorded sale of a time-boxed course granted it forever unless
        // the operator remembered to type a date. It is not `null` any more.
        expect(grantDeadlineValue(false, "")).toBeUndefined();
    });

    it("survives the route's own normalizer as access that never ends", () => {
        const normalized = normalizeDeadline(grantDeadlineValue(true, "2026-12-31"));
        expect(normalized).toEqual({ ok: true, value: null });
        if (!normalized.ok) throw new Error("unreachable");

        expect(isEnrollmentExpired(normalized.value, now)).toBe(false);
        expect(daysRemaining(normalized.value, now)).toBeNull();
    });

    it("still turns a real date into an end-of-day deadline that does expire", () => {
        const normalized = normalizeDeadline(grantDeadlineValue(false, "2026-08-27"));
        if (!normalized.ok) throw new Error("expected a valid deadline");

        expect(normalized.value).toBe("2026-08-27T23:59:59.999Z");
        expect(isEnrollmentExpired(normalized.value, now)).toBe(true);
    });
});
