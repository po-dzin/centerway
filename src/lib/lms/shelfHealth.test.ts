/**
 * The watcher that would have caught the 2026-09-01 disappearance.
 *
 * A course fell off the storefront because its rows stopped assembling, and
 * nothing said so for two days. These tests fix the two things that made that
 * silence possible: the audit has to NAME a published course it cannot build,
 * and it has to stay quiet about the states that are merely unusual.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: () => db,
}));

const { auditShelf, formatShelfAudit } = await import("./shelfHealth");

const courseRow = (overrides: Partial<Row> = {}): Row => ({
  id: "c",
  slug: "reset-day",
  title: "Reset Day",
  program_slug: "reset-day",
  brand: "centerway",
  locale: "uk",
  translation_group_id: "g",
  status: "published",
  visibility: "listed",
  version: 1,
  summary: null,
  schedule: { mode: "open" },
  entitlement_product_codes: [],
  theme: null,
  cover: null,
  sort_order: null,
  ...overrides,
});

const moduleRow: Row = { id: "m", course_id: "c", slug: "m", title: "M", order: 1, summary: null, reference: false };

const lessonRow: Row = {
  id: "l",
  course_id: "c",
  module_id: "m",
  slug: "l",
  title: "L",
  order: 1,
  day_index: null,
  duration_min: null,
  summary: null,
  blocks: [{ id: "b", type: "rich_text", content: [{ kind: "p", text: "x" }] }],
};

const offerRow = (overrides: Partial<Row> = {}): Row => ({
  id: "o",
  course_id: "c",
  code: "course:reset-day",
  amount: 795,
  active: true,
  ...overrides,
});

function seed(courses: Row[], offers: Row[] = []) {
  db.tables = {
    lms_courses: courses,
    // Copies, not the shared fixtures: a test that breaks a row on purpose
    // must not break it for the next one.
    lms_modules: [{ ...moduleRow }],
    lms_lessons: [{ ...lessonRow }],
    lms_course_offers: offers,
  };
  db.failures = {};
}

beforeEach(() => seed([courseRow()], [offerRow()]));

describe("auditShelf", () => {
  it("says nothing about a course the storefront can build and show", async () => {
    const audit = await auditShelf();

    expect(audit.faults).toEqual([]);
    expect(audit.courses).toBe(1);
    expect(formatShelfAudit(audit)).toBeNull();
  });

  /* THE ACTUAL INCIDENT, in the shape it had: every column says «на продажу»
     and the shelf cannot assemble the row. Before this the only trace was a
     console.warn on a server nobody was watching. */
  it("names a published course whose rows no longer assemble", async () => {
    // A module row from before the `reference` migration — the same class of
    // fault as a tightened field ceiling: valid-looking data the contract
    // refuses, and `listLiveCourses` silently skips.
    delete (db.tables.lms_modules[0] as Row).reference;

    const audit = await auditShelf();

    expect(audit.faults).toHaveLength(1);
    expect(audit.faults[0]).toMatchObject({ slug: "reset-day", kind: "unrenderable" });
    expect(audit.faults[0].detail).toMatch(/reference/);
    expect(formatShelfAudit(audit)).toContain("reset-day");
  });

  it("leaves an author's broken DRAFT alone", async () => {
    // Mid-edit material is not an incident, and a watcher that reports it
    // teaches its reader to dismiss the ones that matter.
    seed([courseRow({ status: "draft", visibility: "hidden" })], []);
    delete (db.tables.lms_modules[0] as Row).reference;

    expect((await auditShelf()).faults).toEqual([]);
  });

  it("still reports a broken draft that is being SOLD", async () => {
    seed([courseRow({ status: "draft", visibility: "hidden" })], [offerRow()]);
    delete (db.tables.lms_modules[0] as Row).reference;

    expect((await auditShelf()).faults[0]).toMatchObject({ kind: "unrenderable" });
  });

  it("names an active offer pointing at a course no stranger may open", async () => {
    seed([courseRow({ status: "published", visibility: "hidden" })], [offerRow()]);

    const audit = await auditShelf();

    expect(audit.faults[0]).toMatchObject({ slug: "reset-day", kind: "sold_but_not_public" });
  });

  /* Sold from a landing page and deliberately off the shelf — the whole reason
     `unlisted` exists. Reporting it would be reporting a product decision. */
  it("accepts an unlisted course that is on sale", async () => {
    seed([courseRow({ visibility: "unlisted" })], [offerRow()]);

    expect((await auditShelf()).faults).toEqual([]);
  });

  it("ignores a withdrawn offer on a hidden course", async () => {
    seed([courseRow({ visibility: "hidden", status: "draft" })], [offerRow({ active: false })]);

    expect((await auditShelf()).faults).toEqual([]);
  });
});
