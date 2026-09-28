import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import { loadOpeningCodes, loadOwnCodes, openingCodesFor } from "./openingCodes";

const db = new FakeSupabase();

beforeEach(() => {
  db.tables = {
    course_opening_codes: [
      { course_id: "course-way21", code: "course:way21" },
      { course_id: "course-way21", code: "way21-support" },
      { course_id: "course-way21", code: "way21_support" },
      { course_id: "course-soul", code: "course:novyi-kurs-5" },
    ],
  };
  db.failures = {};
});

describe("openingCodesFor", () => {
  it("widens the course's declared codes with what the offer tables say", async () => {
    const opening = await loadOpeningCodes(db as never, ["course-way21", "course-soul"]);
    const way21 = openingCodesFor({ id: "course-way21", entitlementProductCodes: ["way21", "way21-support"] }, opening);
    expect(way21).toEqual(expect.arrayContaining(["way21", "way21-support", "course:way21", "way21_support"]));
    expect(new Set(way21).size).toBe(way21.length);

    // A course renamed in the builder keeps its old buyers without anyone typing the old code.
    expect(openingCodesFor({ id: "course-soul", entitlementProductCodes: [] }, opening)).toEqual([
      "course:novyi-kurs-5",
    ]);
  });

  it("falls back to the declared codes alone when the view cannot be read", async () => {
    db.failures = { "course_opening_codes:select": "boom" };
    const opening = await loadOpeningCodes(db as never, ["course-way21"]);
    expect(openingCodesFor({ id: "course-way21", entitlementProductCodes: ["way21"] }, opening)).toEqual(["way21"]);
  });

  it("asks for nothing when there are no courses", async () => {
    expect((await loadOpeningCodes(db as never, [])).size).toBe(0);
  });
});

/* OWN vs BUNDLE (2026-09-25). A cohort format of Шлях 21 opens Reset Day, but
   whoever bought it did not buy Reset Day: the reminders and the shelf ask for
   the codes that say «bought THIS program», and a bundle's code is not one. */
describe("loadOwnCodes", () => {
  const WAY21 = { id: "course-way21", slug: "way21", entitlementProductCodes: ["way21", "Way21-Support"] };
  const RESET = { id: "course-reset", slug: "reset-day", entitlementProductCodes: [] };
  const LEGACY = { id: "course-legacy", slug: "legacy", entitlementProductCodes: ["legacy-funnel"] };

  function seedOffers() {
    db.tables = {
      lms_courses: [
        { id: "course-way21", experience_id: "exp-way21" },
        { id: "course-reset", experience_id: "exp-reset" },
        { id: "course-legacy", experience_id: null },
      ],
      experience_offers: [
        { id: "o-way21", code: "course:way21", experience_id: "exp-way21" },
        { id: "o-way21-group", code: "Way21-Group", experience_id: "exp-way21" },
        { id: "o-reset", code: "course:reset-day", experience_id: "exp-reset" },
      ],
      offer_aliases: [{ code: "way21_group_old", offer_id: "o-way21-group" }],
      // The view says the group format opens Reset Day — own codes must not.
      course_opening_codes: [{ course_id: "course-reset", code: "way21-group" }],
    };
    db.failures = {};
  }

  it("owns the declared codes, the course: code, and every code or old code of the course's own offers", async () => {
    seedOffers();
    const own = await loadOwnCodes(db as never, [WAY21, RESET, LEGACY]);

    expect([...(own.get("course-way21") ?? [])].sort()).toEqual(
      ["course:way21", "way21", "way21-group", "way21-support", "way21_group_old"].sort(),
    );
    expect([...(own.get("course-legacy") ?? [])].sort()).toEqual(["course:legacy", "legacy-funnel"]);
  });

  it("does not count a bundle that carries the course in as the course's own code", async () => {
    seedOffers();
    const own = await loadOwnCodes(db as never, [RESET]);
    expect([...(own.get("course-reset") ?? [])]).toEqual(["course:reset-day"]);
    expect(own.get("course-reset")?.has("way21-group")).toBe(false);
  });

  it("answers with the declared codes alone when the offer tables cannot be read", async () => {
    seedOffers();
    db.failures = { "experience_offers:select": "boom" };
    const own = await loadOwnCodes(db as never, [WAY21]);
    expect([...(own.get("course-way21") ?? [])].sort()).toEqual(["course:way21", "way21", "way21-support"]);
  });

  it("asks for nothing when there are no courses", async () => {
    seedOffers();
    db.failures = { "lms_courses:select": "should not be read" };
    expect((await loadOwnCodes(db as never, [])).size).toBe(0);
  });
});
