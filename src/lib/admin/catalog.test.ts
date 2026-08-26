/**
 * The catalogue: what stops a course from being sold, and what an offer must say.
 *
 * The readiness checklist is the load-bearing part. Before it, "not for sale"
 * was a state with no explanation and no exit — `ideal-body` sat published,
 * unreviewed and invisible, and no screen could say which of the gates it was
 * behind or open any of them.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
    adminClient: () => db,
}));

const { listCatalog, saleBlockersOf, saveOffer, setOfferActive } = await import("./catalog");

const ADMIN = "auth-admin";

const offerOf = (overrides: Partial<Row> = {}): Row => ({
    id: "offer-1",
    course_id: "course-reset",
    code: "course:reset-day",
    amount: 795,
    list_amount: null,
    currency: "UAH",
    pixel_content_name: "Reset Day",
    access_days: 30,
    access_lifetime: false,
    active: true,
    ...overrides,
});

function seed(courses: Row[], offers: Row[] = []) {
    db.tables = {
        lms_courses: courses,
        lms_course_offers: offers,
        lms_enrollments: [{ id: "enr-1", course_id: "course-reset" }],
        platform_users: [{ auth_user_id: "auth-author", email: "author@example.com" }],
        audit_log: [],
    };
    db.failures = {};
}

const course = (overrides: Partial<Row> = {}): Row => ({
    id: "course-reset",
    slug: "reset-day",
    title: "Reset Day",
    status: "published",
    review_status: "approved",
    visibility: "listed",
    author_id: null,
    pending_content: null,
    updated_at: "2026-08-26T00:00:00.000Z",
    ...overrides,
});

beforeEach(() => seed([course()], [offerOf()]));

describe("saleBlockersOf", () => {
    it("says nothing when the course is genuinely on sale", () => {
        expect(
            saleBlockersOf({
                status: "published",
                reviewStatus: "approved",
                visibility: "listed",
                offer: { accessDays: 30, accessLifetime: false, active: true } as never,
            })
        ).toEqual([]);
    });

    /* The corner that had no exit: published by the author, never reviewed,
       so invisible — and nothing said so. */
    it("names approval and visibility for a course published straight from the builder", () => {
        expect(
            saleBlockersOf({ status: "published", reviewStatus: "draft", visibility: "hidden", offer: null })
        ).toEqual(["not_approved", "hidden", "no_offer"]);
    });

    it("does not nag about approval before the author has published at all", () => {
        expect(
            saleBlockersOf({ status: "draft", reviewStatus: "draft", visibility: "hidden", offer: null })
        ).toEqual(["not_published", "hidden", "no_offer"]);
    });

    it("catches an offer that states no term", () => {
        expect(
            saleBlockersOf({
                status: "published",
                reviewStatus: "approved",
                visibility: "listed",
                offer: { accessDays: null, accessLifetime: false, active: true } as never,
            })
        ).toEqual(["no_access_rule"]);
    });
});

describe("listCatalog", () => {
    it("folds the course, its offer and its readiness into one row", async () => {
        const rows = await listCatalog();

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            slug: "reset-day",
            learners: 1,
            blockers: [],
        });
        expect(rows[0].offer).toMatchObject({ amount: 795, accessDays: 30, accessLifetime: false });
    });

    it("treats a course from before the review columns as approved, not as pending forever", async () => {
        seed([course({ review_status: null })], [offerOf()]);

        const rows = await listCatalog();
        expect(rows[0].reviewStatus).toBe("approved");
    });
});

describe("saveOffer", () => {
    it("writes the price and the term together", async () => {
        seed([course()], []);

        const result = await saveOffer({ courseId: "course-reset", actorId: ADMIN, amount: 990, accessDays: 90 });

        expect(result).toMatchObject({ code: "course:reset-day", created: true });
        const row = db.rows("lms_course_offers")[0];
        expect(row).toMatchObject({ amount: 990, access_days: 90, access_lifetime: false, active: true });
        // The Meta label defaults to the course title on creation.
        expect(row.pixel_content_name).toBe("Reset Day");
    });

    /* An offer with no term grants perpetual access to everyone who ever buys
       it, silently, and in the direction that cannot be taken back. */
    it("refuses an offer that says nothing about time", async () => {
        await expect(
            saveOffer({ courseId: "course-reset", actorId: ADMIN, amount: 990 })
        ).rejects.toMatchObject({ message: "access_rule_required" });
    });

    it("accepts an explicit forever", async () => {
        await saveOffer({ courseId: "course-reset", actorId: ADMIN, amount: 990, accessLifetime: true });

        expect(db.rows("lms_course_offers")[0]).toMatchObject({ access_days: null, access_lifetime: true });
    });

    it("refuses a struck-through figure below what is charged", async () => {
        await expect(
            saveOffer({ courseId: "course-reset", actorId: ADMIN, amount: 990, listAmount: 500, accessDays: 30 })
        ).rejects.toMatchObject({ message: "list_amount_invalid" });
    });

    /* Renaming it splits one product's history into two lines in Meta. */
    it("never rewrites the pixel label of an existing offer", async () => {
        seed([course({ title: "Reset Day 2.0" })], [offerOf()]);

        await saveOffer({ courseId: "course-reset", actorId: ADMIN, amount: 1200, accessDays: 30 });

        expect(db.rows("lms_course_offers")[0].pixel_content_name).toBe("Reset Day");
    });
});

describe("setOfferActive", () => {
    it("withdraws without deleting — the row is the record of what was sold", async () => {
        await setOfferActive({ courseId: "course-reset", active: false, actorId: ADMIN });

        expect(db.rows("lms_course_offers")).toHaveLength(1);
        expect(db.rows("lms_course_offers")[0].active).toBe(false);
    });

    it("refuses a course that was never priced", async () => {
        seed([course()], []);

        await expect(
            setOfferActive({ courseId: "course-reset", active: false, actorId: ADMIN })
        ).rejects.toMatchObject({ message: "offer_not_found" });
    });
});
