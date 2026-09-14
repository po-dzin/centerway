import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

import { applyAccessTermToOffer } from "./offerTerm";

const db = new FakeSupabase();

const offer = (overrides: Partial<Row> = {}): Row => ({
  id: "offer-1",
  course_id: "course-1",
  code: "course:reset-day",
  access_days: 30,
  access_lifetime: false,
  ...overrides,
});

beforeEach(() => {
  db.tables = { lms_course_offers: [offer()], audit_log: [] };
  db.failures = {};
});

const apply = (note: string | null, actorId: string | null = "author-1") =>
  applyAccessTermToOffer(db as never, { courseId: "course-1", note, actorId, source: "builder" });

describe("applyAccessTermToOffer", () => {
  it("moves the offer's real term to the preset the author chose, and says so in the audit", async () => {
    expect(await apply("Пів року")).toBe("updated");
    expect(db.rows("lms_course_offers")[0]).toMatchObject({ access_days: 180, access_lifetime: false });
    expect(db.rows("audit_log")[0]).toMatchObject({
      action: "catalog.offer.term_from_course",
      entity_id: "course:reset-day",
    });
  });

  it("grants lifetime access for «Назавжди» and clears the day count", async () => {
    expect(await apply("Назавжди")).toBe("updated");
    expect(db.rows("lms_course_offers")[0]).toMatchObject({ access_days: null, access_lifetime: true });
  });

  it("writes nothing when the offer already grants what the words say", async () => {
    expect(await apply("30 днів")).toBe("unchanged");
    expect(db.rows("audit_log")).toHaveLength(0);
  });

  it("does not create an offer — that is the owner's act in the catalogue", async () => {
    db.tables.lms_course_offers = [];
    expect(await apply("Рік")).toBe("no_offer");
    expect(db.rows("lms_course_offers")).toHaveLength(0);
  });

  it("leaves the term alone for words that are not a preset", async () => {
    expect(await apply("доступ назавжди")).toBe("not_a_preset");
    expect(await apply(null)).toBe("not_a_preset");
    expect(db.rows("lms_course_offers")[0]).toMatchObject({ access_days: 30 });
  });
});
