/**
 * The one reader of formats and bundles for the storefront, the checkout and the
 * landings. What it may never do: advertise a format that is not approved and
 * active, or a bonus program that is not published — the page would promise
 * something the purchase does not open.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));

const { loadBundleHosts, loadProgramFormats } = await import("./formats");

const WAY21 = "exp-way21";
const RESET = "exp-reset";
const SHORT = "exp-short";

function offer(row: Record<string, unknown>) {
  return {
    list_amount: null,
    currency: "UAH",
    label: null,
    summary: null,
    features: null,
    cohort_starts_on: null,
    pixel_content_name: null,
    invoice_heading: null,
    invoice_description: null,
    active: true,
    review_status: "approved",
    ...row,
  };
}

beforeEach(() => {
  db.failures = {};
  db.tables = {
    lms_courses: [
      {
        id: "c-way21",
        slug: "way21",
        program_slug: "way21",
        title: "Шлях 21 — інтегративна детокс-програма",
        kind: "course",
        status: "published",
        visibility: "public",
        experience_id: WAY21,
        created_at: "2026-01-01",
      },
      {
        id: "c-reset",
        slug: "reset-day",
        program_slug: "reset-day",
        title: "Розвантажувальний день",
        kind: "mini",
        status: "published",
        visibility: "public",
        experience_id: RESET,
        created_at: "2026-01-01",
      },
      {
        id: "c-short",
        slug: "short",
        program_slug: "reboot",
        title: "Short-Перезавантаження",
        kind: "mini",
        status: "draft",
        visibility: "public",
        experience_id: SHORT,
        created_at: "2026-01-01",
      },
    ],
    experience_offers: [
      offer({
        id: "o-self",
        experience_id: WAY21,
        code: "course:way21",
        mode: "checkout",
        amount: 4100,
        format: null,
        sort_order: 1,
        features: { uk: ["Інструкції", " ", "Підтримка"] },
      }),
      offer({
        id: "o-group",
        experience_id: WAY21,
        code: "way21-group",
        mode: "checkout",
        amount: 4100,
        format: "group",
        sort_order: 2,
        cohort_starts_on: "2026-10-01",
        label: { uk: "У групі потоку" },
      }),
      offer({
        id: "o-support",
        experience_id: WAY21,
        code: "way21-support",
        mode: "lead",
        amount: 9000,
        format: "individual",
        sort_order: 3,
      }),
      offer({
        id: "o-draft",
        experience_id: WAY21,
        code: "way21-vip",
        mode: "checkout",
        amount: null,
        format: "individual",
        sort_order: 4,
        active: false,
        review_status: "proposed",
      }),
      offer({
        id: "o-herbs",
        experience_id: WAY21,
        code: "herbs",
        mode: "checkout",
        amount: 500,
        format: null,
        sort_order: 5,
      }),
    ],
    experience_offer_items: [
      { offer_id: "o-group", experience_id: RESET, sort_order: 1 },
      { offer_id: "o-group", experience_id: SHORT, sort_order: 2 },
      { offer_id: "o-support", experience_id: RESET, sort_order: 1 },
      { offer_id: "o-draft", experience_id: RESET, sort_order: 1 },
    ],
  };
});

describe("loadProgramFormats", () => {
  it("lists the approved, active formats in the author's order, the course's own offer as «self»", async () => {
    const formats = await loadProgramFormats({ id: "c-way21", slug: "way21" });
    expect(formats.map((entry) => [entry.code, entry.format])).toEqual([
      ["course:way21", "self"],
      ["way21-group", "group"],
      ["way21-support", "individual"],
    ]);
  });

  it("reads features without blanks, the label or the default name, and the cohort date", async () => {
    const [self, group, support] = await loadProgramFormats({ id: "c-way21", slug: "way21" });
    expect(self!.features).toEqual(["Інструкції", "Підтримка"]);
    expect(group!.features).toEqual([]);
    expect(group!.label).toBe("У групі потоку");
    expect(support!.label).toBe("Індивідуальний супровід");
    expect(group!.cohortStartsOn).toBe("2026-10-01");
  });

  it("advertises only published bonus programs", async () => {
    const formats = await loadProgramFormats({ id: "c-way21", slug: "way21" });
    const group = formats.find((entry) => entry.code === "way21-group")!;
    // Short is a draft here: promising it would promise something that does not open.
    expect(group.includes.map((program) => program.courseSlug)).toEqual(["reset-day"]);
  });

  it("answers no formats, not someone else's, when the read fails", async () => {
    db.failures = { "experience_offers:select": "boom" };
    await expect(loadProgramFormats({ id: "c-way21", slug: "way21" })).resolves.toEqual([]);
  });
});

describe("loadBundleHosts", () => {
  it("names every approved, active format of another program that opens this one", async () => {
    const hosts = await loadBundleHosts("reset-day");
    expect(hosts).toEqual([
      { code: "way21-group", label: "У групі потоку", programSlug: "way21", programTitle: "Шлях 21" },
      { code: "way21-support", label: "Індивідуальний супровід", programSlug: "way21", programTitle: "Шлях 21" },
    ]);
  });

  it("is empty for a program in no bundle, and for an unknown one", async () => {
    await expect(loadBundleHosts("way21")).resolves.toEqual([]);
    await expect(loadBundleHosts("nope")).resolves.toEqual([]);
  });

  it("drops a format whose own program is not published", async () => {
    db.tables.lms_courses![0]!.status = "draft";
    await expect(loadBundleHosts("reset-day")).resolves.toEqual([]);
  });

  it("answers null — not «no bundles» — when the read fails, so the landing keeps its text", async () => {
    db.failures = { "experience_offer_items:select": "boom" };
    await expect(loadBundleHosts("reset-day")).resolves.toBeNull();
  });
});
