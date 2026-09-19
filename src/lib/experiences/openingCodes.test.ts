import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import { loadOpeningCodes, openingCodesFor } from "./openingCodes";

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
