/**
 * The format constructor, both sides of the creator contract (2026-09-25).
 *
 * The author composes a format and PROPOSES a price; only the owner approves it
 * and writes the live `amount`. What this suite guards is where that contract
 * could leak: an author reaching a price, an author rewriting what paying
 * buyers of an approved format were promised (kind, mode, cohort date, what it
 * opens), an author bundling someone else's program, an author deleting a
 * format that was on sale — and the validation that keeps junk out of the copy
 * a buyer reads.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: () => undefined }));
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));

const {
  FORMAT_FEATURE_MAX,
  FORMAT_LABEL_MAX,
  FORMAT_SUMMARY_MAX,
  FormatError,
  createFormat,
  deleteFormat,
  listCourseFormats,
  listFormatsForReview,
  listIncludablePrograms,
  reviewFormat,
  updateFormat,
} = await import("./formatAuthoring");

const AUTHOR = "user-author";
const STRANGER = "user-stranger";
const ADMIN = "user-admin";

function offer(row: Row): Row {
  return {
    format: null,
    label: null,
    summary: null,
    features: null,
    mode: "checkout",
    amount: null,
    proposed_amount: null,
    currency: "UAH",
    cohort_starts_on: null,
    review_status: "draft",
    active: false,
    featured: false,
    sort_order: 1,
    experience_id: "exp-way21",
    ...row,
  };
}

function offerRow(code: string): Row {
  const row = db.rows("experience_offers").find((item) => item.code === code);
  if (!row) throw new Error(`no offer ${code}`);
  return row;
}

async function expectFormatError(promise: Promise<unknown>, code: string, status?: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(FormatError);
  expect((error as InstanceType<typeof FormatError>).code).toBe(code);
  if (status !== undefined) expect((error as InstanceType<typeof FormatError>).status).toBe(status);
}

const author = { courseId: "c-way21", authUserId: AUTHOR, isAdmin: false };
const admin = { courseId: "c-way21", authUserId: ADMIN, isAdmin: true };
/** The `admin` role: sets the live price itself. `admin` above is `support`-shaped — admin surface, no prices. */
const owner = { ...admin, canSetPrice: true };

beforeEach(() => {
  db.failures = {};
  db.tables = {
    lms_courses: [
      {
        id: "c-way21",
        slug: "way21",
        program_slug: "way21",
        title: "Шлях 21",
        status: "published",
        author_id: AUTHOR,
        experience_id: "exp-way21",
        sort_order: 1,
      },
      {
        id: "c-reset",
        slug: "reset-day",
        program_slug: "reset-day",
        title: "Розвантажувальний день",
        status: "published",
        author_id: AUTHOR,
        experience_id: "exp-reset",
        sort_order: 2,
      },
      {
        id: "c-other",
        slug: "other",
        program_slug: "other",
        title: "Чужа програма",
        status: "published",
        author_id: STRANGER,
        experience_id: "exp-other",
        sort_order: 3,
      },
      {
        id: "c-bare",
        slug: "bare",
        program_slug: null,
        title: "Без досвіду",
        status: "draft",
        author_id: AUTHOR,
        experience_id: null,
        sort_order: 4,
      },
    ],
    experience_offers: [
      offer({
        id: "o-self",
        code: "course:way21",
        amount: 1500,
        active: true,
        review_status: "approved",
        sort_order: 0,
      }),
      offer({
        id: "o-group",
        code: "way21-group",
        format: "group",
        label: { uk: "Потік", en: "Cohort" },
        summary: { uk: "Разом", en: "Together" },
        features: { uk: ["Ефіри"], en: ["Live calls"] },
        amount: 4800,
        active: true,
        review_status: "approved",
        cohort_starts_on: "2026-10-01",
        sort_order: 2,
      }),
      offer({ id: "o-legacy", code: "way21-legacy", sort_order: 5 }),
      offer({ id: "o-other-self", code: "course:other", experience_id: "exp-other", sort_order: 1 }),
    ],
    experience_offer_items: [
      { id: "i-2", offer_id: "o-group", experience_id: "exp-other", sort_order: 2 },
      { id: "i-1", offer_id: "o-group", experience_id: "exp-reset", sort_order: 1 },
      { id: "i-ghost", offer_id: "o-group", experience_id: "exp-gone", sort_order: 3 },
    ],
    offer_aliases: [],
  };
});

describe("listCourseFormats", () => {
  it("returns the course's own offer and every marked format, never an unmarked sibling", async () => {
    const formats = await listCourseFormats("c-way21");
    expect(formats.map((format) => format.code)).toEqual(["course:way21", "way21-group"]);
  });

  it("reads the own offer as the self-paced format with the default label", async () => {
    const [own] = await listCourseFormats("c-way21");
    expect(own).toMatchObject({
      format: "self",
      label: "Самостійно",
      labelIsDefault: true,
      summary: "",
      features: [],
      mode: "checkout",
      amount: 1500,
      reviewStatus: "approved",
      active: true,
      includes: [],
    });
  });

  it("reads authored copy and the included programs in their order, skipping one that no longer exists", async () => {
    const group = (await listCourseFormats("c-way21"))[1];
    expect(group).toMatchObject({
      label: "Потік",
      labelIsDefault: false,
      summary: "Разом",
      features: ["Ефіри"],
      cohortStartsOn: "2026-10-01",
      includes: [
        { slug: "reset-day", title: "Розвантажувальний день" },
        { slug: "other", title: "Чужа програма" },
      ],
    });
  });

  it("refuses a course that has no experience yet", async () => {
    await expectFormatError(listCourseFormats("c-bare"), "format_course_not_registered", 409);
  });

  it("reports a failed read as a 500, not as an empty list", async () => {
    db.failures = { "experience_offers:select": "boom" };
    await expectFormatError(listCourseFormats("c-way21"), "format_read_failed:boom", 500);
  });
});

describe("listIncludablePrograms", () => {
  it("offers an author only their own other programs", async () => {
    const programs = await listIncludablePrograms(author);
    expect(programs.map((program) => program.slug)).toEqual(["reset-day", "bare"]);
  });

  it("offers an admin every program but this one", async () => {
    const programs = await listIncludablePrograms(admin);
    expect(programs.map((program) => program.slug)).toEqual(["reset-day", "other", "bare"]);
    expect(programs[0]).toEqual({ slug: "reset-day", title: "Розвантажувальний день", status: "published" });
  });

  it("reports a failed read", async () => {
    db.failures = { "lms_courses:select": "down" };
    await expectFormatError(listIncludablePrograms(author), "format_programs_read_failed:down", 500);
  });
});

describe("createFormat", () => {
  it("creates a draft with a proposed price and never a live one", async () => {
    const code = await createFormat({
      ...author,
      body: { format: "individual", label: "  Супровід  ", proposedAmount: 9000 },
    });
    expect(code).toBe("way21-individual");
    expect(offerRow(code)).toMatchObject({
      experience_id: "exp-way21",
      format: "individual",
      mode: "lead",
      amount: null,
      active: false,
      currency: "UAH",
      review_status: "draft",
      proposed_amount: 9000,
      proposed_by: AUTHOR,
      proposed_at: null,
      label: { uk: "Супровід", en: "Супровід" },
      summary: null,
      features: null,
      sort_order: 6,
    });
  });

  it("sends it for approval when submitted, stamping when", async () => {
    const code = await createFormat({ ...author, body: { format: "self", submit: true } });
    expect(offerRow(code)).toMatchObject({ review_status: "proposed", mode: "checkout", proposed_by: AUTHOR });
    expect(typeof offerRow(code).proposed_at).toBe("string");
  });

  it("takes the next free code, past offers and aliases already holding one", async () => {
    db.tables.offer_aliases = [{ code: "way21-group-2" }];
    const code = await createFormat({ ...author, body: { format: "group" } });
    expect(code).toBe("way21-group-3");
  });

  it("keeps a cohort date only on a group format", async () => {
    const group = await createFormat({ ...author, body: { format: "group", cohortStartsOn: "2026-11-01" } });
    const self = await createFormat({ ...author, body: { format: "self", cohortStartsOn: "2026-11-01" } });
    expect(offerRow(group).cohort_starts_on).toBe("2026-11-01");
    expect(offerRow(self).cohort_starts_on).toBeNull();
  });

  it("stores features with blank lines dropped", async () => {
    const code = await createFormat({ ...author, body: { format: "self", features: ["  Уроки ", "", "   ", "Чат"] } });
    expect(offerRow(code).features).toEqual({ uk: ["Уроки", "Чат"], en: ["Уроки", "Чат"] });
  });

  it("writes the author's own programs as includes, in the order given", async () => {
    const code = await createFormat({ ...author, body: { format: "group", includes: ["reset-day", "reset-day"] } });
    const id = offerRow(code).id;
    const items = db.rows("experience_offer_items").filter((item) => item.offer_id === id);
    expect(items).toEqual([expect.objectContaining({ experience_id: "exp-reset", sort_order: 1 })]);
  });

  it("refuses to bundle someone else's program — and leaves nothing behind", async () => {
    const before = db.rows("experience_offers").length;
    await expectFormatError(
      createFormat({ ...author, body: { format: "group", includes: ["other"] } }),
      "format_include_not_yours",
      403,
    );
    expect(db.rows("experience_offers")).toHaveLength(before);
  });

  it("lets an admin bundle any program", async () => {
    const code = await createFormat({ ...admin, body: { format: "group", includes: ["other"] } });
    const id = offerRow(code).id;
    expect(db.rows("experience_offer_items").filter((item) => item.offer_id === id)).toHaveLength(1);
  });

  it("requires a kind", async () => {
    await expectFormatError(createFormat({ ...author, body: {} }), "format_invalid_kind");
    await expectFormatError(createFormat({ ...author, body: { format: "vip" } }), "format_invalid_kind");
  });

  it("refuses a course without an experience before writing anything", async () => {
    await expectFormatError(
      createFormat({ ...author, courseId: "c-bare", body: { format: "self" } }),
      "format_course_not_registered",
      409,
    );
  });

  it("reports a failed insert", async () => {
    db.failures = { "experience_offers:insert": "nope" };
    await expectFormatError(createFormat({ ...author, body: { format: "self" } }), "format_write_failed:nope", 500);
  });
});

describe("format input validation", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["a label that is not text", { label: 5 }, "format_invalid_label"],
    ["a label over the limit", { label: "x".repeat(FORMAT_LABEL_MAX + 1) }, "format_label_too_long"],
    ["a summary that is not text", { summary: ["x"] }, "format_invalid_summary"],
    ["a summary over the limit", { summary: "x".repeat(FORMAT_SUMMARY_MAX + 1) }, "format_summary_too_long"],
    ["features that are not a list", { features: "a" }, "format_invalid_features"],
    ["features holding a non-string", { features: ["a", 2] }, "format_invalid_features"],
    [
      "more than twelve features",
      { features: Array.from({ length: 13 }, (_, i) => `f${i}`) },
      "format_features_too_many",
    ],
    ["a feature over the limit", { features: ["x".repeat(FORMAT_FEATURE_MAX + 1)] }, "format_feature_too_long"],
    ["an unknown mode", { mode: "free" }, "format_invalid_mode"],
    ["a fractional price", { proposedAmount: 10.5 }, "format_invalid_amount"],
    ["a zero price", { proposedAmount: 0 }, "format_invalid_amount"],
    ["a price as text", { proposedAmount: "100" }, "format_invalid_amount"],
    ["a price over the ceiling", { proposedAmount: 1_000_001 }, "format_invalid_amount"],
    ["a cohort date in another shape", { cohortStartsOn: "01.10.2026" }, "format_invalid_cohort_date"],
    ["includes that are not a list of slugs", { includes: [1] }, "format_invalid_includes"],
  ];

  it.each(cases)("refuses %s", async (_name, body, code) => {
    await expectFormatError(createFormat({ ...author, body: { format: "self", ...body } }), code, 400);
  });

  it("counts features after blank lines are dropped, and accepts exactly the limits", async () => {
    const features = [...Array.from({ length: 12 }, (_, i) => `f${i}`), "", "  "];
    const code = await createFormat({
      ...author,
      body: {
        format: "self",
        label: "x".repeat(FORMAT_LABEL_MAX),
        summary: "y".repeat(FORMAT_SUMMARY_MAX),
        features: [...features.slice(0, 11), "z".repeat(FORMAT_FEATURE_MAX), ...features.slice(12)],
        proposedAmount: 1_000_000,
      },
    });
    expect((offerRow(code).features as { uk: string[] }).uk).toHaveLength(12);
  });
});

describe("updateFormat", () => {
  beforeEach(() => {
    db.tables.experience_offers!.push(
      offer({
        id: "o-draft",
        code: "way21-individual",
        format: "individual",
        mode: "lead",
        review_status: "draft",
        features: { uk: ["Старе"], en: ["Old, translated"] },
        sort_order: 3,
      }),
      offer({ id: "o-declined", code: "way21-self", format: "self", review_status: "declined", sort_order: 4 }),
    );
  });

  it("lets an author change anything on a draft", async () => {
    await updateFormat({
      ...author,
      code: "way21-individual",
      body: { format: "group", mode: "checkout", cohortStartsOn: "2026-12-01", label: "Новий", proposedAmount: 3000 },
    });
    expect(offerRow("way21-individual")).toMatchObject({
      format: "group",
      mode: "checkout",
      cohort_starts_on: "2026-12-01",
      label: { uk: "Новий", en: "Новий" },
      proposed_amount: 3000,
      proposed_by: AUTHOR,
      review_status: "draft",
    });
  });

  it("keeps an English feature list written elsewhere", async () => {
    await updateFormat({ ...author, code: "way21-individual", body: { features: ["Нове"] } });
    expect(offerRow("way21-individual").features).toEqual({ uk: ["Нове"], en: ["Old, translated"] });
  });

  it("clears copy when it is emptied", async () => {
    await updateFormat({ ...author, code: "way21-individual", body: { label: "  ", features: [" "] } });
    expect(offerRow("way21-individual")).toMatchObject({ label: null, features: null });
  });

  it("an empty cohort date clears it", async () => {
    await updateFormat({ ...admin, code: "way21-group", body: { cohortStartsOn: "" } });
    expect(offerRow("way21-group").cohort_starts_on).toBeNull();
  });

  it("lets only the owner mark a «Бестселер», one per program", async () => {
    await expectFormatError(
      updateFormat({ ...admin, code: "way21-group", body: { featured: true } }),
      "format_featured_owner_only",
      403,
    );
    await expectFormatError(
      updateFormat({ ...owner, code: "way21-group", body: { featured: "yes" } }),
      "format_invalid_featured",
    );
    offerRow("course:other").featured = true;
    await updateFormat({ ...owner, code: "way21-group", body: { featured: true } });
    expect(offerRow("way21-group").featured).toBe(true);
    await updateFormat({ ...owner, code: "course:way21", body: { featured: true } });
    expect(offerRow("course:way21").featured).toBe(true);
    expect(offerRow("way21-group").featured).toBe(false);
    // Another program's mark is its own.
    expect(offerRow("course:other").featured).toBe(true);
    await updateFormat({ ...owner, code: "course:way21", body: { featured: false } });
    expect(offerRow("course:way21").featured).toBe(false);
  });

  it("lets only the owner set an early price, lower than the regular one, and remove it", async () => {
    await expectFormatError(
      updateFormat({ ...admin, code: "way21-group", body: { early: { amount: 3400, until: "2026-10-15" } } }),
      "format_early_owner_only",
      403,
    );
    await expectFormatError(
      updateFormat({ ...owner, code: "way21-group", body: { early: { amount: 4800, until: "2026-10-15" } } }),
      "format_early_not_lower",
    );
    await expectFormatError(
      updateFormat({ ...owner, code: "way21-group", body: { early: { amount: 3400, until: "15.10" } } }),
      "format_invalid_early_date",
    );
    await updateFormat({ ...owner, code: "way21-group", body: { early: { amount: 3400, until: "2026-10-15" } } });
    expect(offerRow("way21-group")).toMatchObject({ amount: 4800, early_amount: 3400, early_until: "2026-10-15" });
    // The regular price cannot drop under the early one while it is stored.
    await expectFormatError(
      updateFormat({ ...owner, code: "way21-group", body: { proposedAmount: 3000 } }),
      "format_early_not_lower",
    );
    await updateFormat({ ...owner, code: "way21-group", body: { early: null } });
    expect(offerRow("way21-group")).toMatchObject({ early_amount: null, early_until: null });
  });

  it("submitting sends a draft and a reworked decline to the owner", async () => {
    await updateFormat({ ...author, code: "way21-individual", body: { submit: true } });
    await updateFormat({ ...author, code: "way21-self", body: { submit: true } });
    expect(offerRow("way21-individual").review_status).toBe("proposed");
    expect(offerRow("way21-self").review_status).toBe("proposed");
    expect(typeof offerRow("way21-self").proposed_at).toBe("string");
  });

  it("an approved format stays approved and on sale; a new price waits beside the live one", async () => {
    await updateFormat({
      ...author,
      code: "way21-group",
      body: { proposedAmount: 5200, submit: true, label: "Потік 2" },
    });
    expect(offerRow("way21-group")).toMatchObject({
      review_status: "approved",
      active: true,
      amount: 4800,
      proposed_amount: 5200,
      label: { uk: "Потік 2", en: "Потік 2" },
    });
  });

  it.each([
    ["kind", { format: "self" }],
    ["mode", { mode: "lead" }],
    ["cohort date", { cohortStartsOn: "2026-10-15" }],
    ["includes", { includes: [] }],
  ])("refuses an author changing the %s of an approved format, writing nothing", async (_name, body) => {
    const before = { ...offerRow("way21-group") };
    await expectFormatError(
      updateFormat({ ...author, code: "way21-group", body: { label: "Інше", ...body } }),
      "format_approved_locked",
      409,
    );
    expect(offerRow("way21-group")).toEqual(before);
    expect(db.rows("experience_offer_items")).toHaveLength(3);
  });

  it("lets the owner move the cohort date of an approved format, which stays on sale", async () => {
    await updateFormat({ ...admin, code: "way21-group", body: { cohortStartsOn: "2026-11-01" } });
    expect(offerRow("way21-group")).toMatchObject({ cohort_starts_on: "2026-11-01", review_status: "approved" });
  });

  it("lets the owner change what an approved format opens", async () => {
    await updateFormat({ ...admin, code: "way21-group", body: { includes: ["other"], mode: "lead" } });
    const items = db.rows("experience_offer_items").filter((item) => item.offer_id === "o-group");
    expect(items).toEqual([expect.objectContaining({ experience_id: "exp-other", sort_order: 1 })]);
    expect(offerRow("way21-group").mode).toBe("lead");
  });

  it("stops when the old bundle cannot be cleared, instead of mixing old and new", async () => {
    db.failures = { "experience_offer_items:delete": "boom" };
    await expect(
      updateFormat({ ...author, code: "way21-individual", body: { includes: ["reset-day"] } }),
    ).rejects.toMatchObject({ code: "format_includes_write_failed:boom", status: 500 });
    db.failures = {};
  });

  it("replaces an author's includes with their own programs only — and a refusal changes nothing", async () => {
    await updateFormat({ ...author, code: "way21-individual", body: { includes: ["reset-day"] } });
    expect(db.rows("experience_offer_items").filter((item) => item.offer_id === "o-draft")).toHaveLength(1);

    await expectFormatError(
      updateFormat({ ...author, code: "way21-individual", body: { label: "Спроба", includes: ["other"] } }),
      "format_include_not_yours",
      403,
    );
    expect(offerRow("way21-individual").label).toBeNull();
    expect(db.rows("experience_offer_items").filter((item) => item.offer_id === "o-draft")).toEqual([
      expect.objectContaining({ experience_id: "exp-reset" }),
    ]);
  });

  it("does not find a format of another course", async () => {
    await expectFormatError(
      updateFormat({ ...author, code: "course:other", body: { label: "x" } }),
      "format_not_found",
      404,
    );
    await expectFormatError(updateFormat({ ...author, code: "nope", body: {} }), "format_not_found", 404);
  });

  it("does not write when nothing changed", async () => {
    db.failures = { "experience_offers:update": "should not be called" };
    await updateFormat({ ...author, code: "way21-individual", body: {} });
  });

  it("reports a failed write", async () => {
    db.failures = { "experience_offers:update": "locked" };
    await expectFormatError(
      updateFormat({ ...author, code: "way21-individual", body: { label: "x" } }),
      "format_write_failed:locked",
      500,
    );
  });
});

describe("deleteFormat", () => {
  it("withdraws a format that never went on sale", async () => {
    db.tables.experience_offers!.push(offer({ id: "o-draft", code: "way21-self", format: "self" }));
    await deleteFormat({ courseId: "c-way21", isAdmin: false, code: "way21-self" });
    expect(db.rows("experience_offers").some((row) => row.code === "way21-self")).toBe(false);
  });

  it("refuses to delete an approved format, even for the owner", async () => {
    await expectFormatError(
      deleteFormat({ courseId: "c-way21", isAdmin: false, code: "way21-group" }),
      "format_approved_locked",
      409,
    );
    await expectFormatError(
      deleteFormat({ courseId: "c-way21", isAdmin: true, code: "way21-group" }),
      "format_approved_locked",
      409,
    );
    expect(offerRow("way21-group")).toBeDefined();
  });

  it("does not reach a format of another course", async () => {
    await expectFormatError(
      deleteFormat({ courseId: "c-way21", isAdmin: false, code: "course:other" }),
      "format_not_found",
      404,
    );
    expect(offerRow("course:other")).toBeDefined();
  });
});

describe("listFormatsForReview", () => {
  it("lists every formatted program's formats, proposals first and drafts last", async () => {
    db.tables.experience_offers!.push(
      offer({ id: "o-other-draft", code: "other-group", format: "group", experience_id: "exp-other" }),
      offer({
        id: "o-other-prop",
        code: "other-self",
        format: "self",
        experience_id: "exp-other",
        review_status: "proposed",
        proposed_amount: 700,
      }),
    );
    const formats = await listFormatsForReview();
    expect(formats.map((format) => [format.code, format.courseSlug])).toEqual([
      ["other-self", "other"],
      ["course:way21", "way21"],
      ["way21-group", "way21"],
      ["course:other", "other"],
      ["other-group", "other"],
    ]);
    expect(formats[0]!.courseTitle).toBe("Чужа програма");
  });

  it("skips a program that has no marked format", async () => {
    db.tables.experience_offers = db.rows("experience_offers").filter((row) => row.experience_id !== "exp-way21");
    db.tables.experience_offers!.push(
      offer({ id: "o-r", code: "reset-day-self", format: "self", experience_id: "exp-reset" }),
    );
    const formats = await listFormatsForReview();
    expect(new Set(formats.map((format) => format.courseSlug))).toEqual(new Set(["reset-day"]));
  });
});

describe("reviewFormat", () => {
  beforeEach(() => {
    db.tables.experience_offers!.push(
      offer({
        id: "o-prop",
        code: "way21-self",
        format: "self",
        review_status: "proposed",
        proposed_amount: 2000,
      }),
      offer({ id: "o-lead", code: "way21-individual", format: "individual", mode: "lead", review_status: "proposed" }),
    );
  });

  it("approving writes the owner's live price and puts the format on sale", async () => {
    await reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "approve", amount: 1800 } });
    expect(offerRow("way21-self")).toMatchObject({
      amount: 1800,
      list_amount: null,
      review_status: "approved",
      active: true,
      proposed_amount: null,
      reviewed_by: ADMIN,
    });
    expect(typeof offerRow("way21-self").reviewed_at).toBe("string");
  });

  it("writes only to experience_offers", async () => {
    const before = Object.fromEntries(
      Object.entries(db.tables)
        .filter(([table]) => table !== "experience_offers")
        .map(([table, rows]) => [table, JSON.stringify(rows)]),
    );
    await reviewFormat({
      code: "way21-self",
      actorId: ADMIN,
      decision: { action: "approve", amount: 1800, listAmount: 2400 },
    });
    for (const [table, rows] of Object.entries(before)) expect(JSON.stringify(db.tables[table])).toBe(rows);
    expect(offerRow("way21-self").list_amount).toBe(2400);
  });

  it.each([
    ["no price", null],
    ["a zero price", 0],
    ["a fractional price", 12.5],
    ["a price over the ceiling", 1_000_001],
  ])("refuses to put a checkout format on sale with %s", async (_name, amount) => {
    await expectFormatError(
      reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "approve", amount } }),
      "format_invalid_amount",
    );
    expect(offerRow("way21-self")).toMatchObject({ review_status: "proposed", active: false });
  });

  it("approves a lead format without a price", async () => {
    await reviewFormat({ code: "way21-individual", actorId: ADMIN, decision: { action: "approve", amount: null } });
    expect(offerRow("way21-individual")).toMatchObject({ review_status: "approved", active: true, amount: null });
  });

  it("refuses a bad list price", async () => {
    await expectFormatError(
      reviewFormat({
        code: "way21-self",
        actorId: ADMIN,
        decision: { action: "approve", amount: 100, listAmount: -1 },
      }),
      "format_invalid_list_amount",
    );
  });

  it("declining a proposal takes it off sale", async () => {
    await reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "decline" } });
    expect(offerRow("way21-self")).toMatchObject({ review_status: "declined", active: false, reviewed_by: ADMIN });
  });

  it("declining a price change on a live format keeps the format and its price", async () => {
    offerRow("way21-group").proposed_amount = 9999;
    await reviewFormat({ code: "way21-group", actorId: ADMIN, decision: { action: "decline" } });
    expect(offerRow("way21-group")).toMatchObject({
      review_status: "approved",
      active: true,
      amount: 4800,
      proposed_amount: null,
      reviewed_by: ADMIN,
    });
  });

  it("withdraw and resume toggle only whether an approved format sells", async () => {
    await reviewFormat({ code: "way21-group", actorId: ADMIN, decision: { action: "withdraw" } });
    expect(offerRow("way21-group")).toMatchObject({ active: false, review_status: "approved", amount: 4800 });
    await reviewFormat({ code: "way21-group", actorId: ADMIN, decision: { action: "resume" } });
    expect(offerRow("way21-group")).toMatchObject({ active: true, review_status: "approved", amount: 4800 });
  });

  it("refuses to resume or withdraw a format that was never approved", async () => {
    await expectFormatError(
      reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "resume" } }),
      "format_not_approved",
      409,
    );
    await expectFormatError(
      reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "withdraw" } }),
      "format_not_approved",
      409,
    );
    expect(offerRow("way21-self").active).toBe(false);
  });

  it("answers 404 for an unknown code and 500 for a failed write", async () => {
    await expectFormatError(
      reviewFormat({ code: "nope", actorId: ADMIN, decision: { action: "decline" } }),
      "format_not_found",
      404,
    );
    db.failures = { "experience_offers:update": "down" };
    await expectFormatError(
      reviewFormat({ code: "way21-self", actorId: ADMIN, decision: { action: "approve", amount: 100 } }),
      "format_write_failed:down",
      500,
    );
  });
});

describe("the owner prices without review (2026-10-03)", () => {
  it("puts a format the owner sends on sale at the price typed, with nothing left to approve", async () => {
    const code = await createFormat({ ...owner, body: { format: "self", proposedAmount: 2900, submit: true } });
    expect(offerRow(code)).toMatchObject({
      amount: 2900,
      proposed_amount: null,
      review_status: "approved",
      active: true,
      reviewed_by: ADMIN,
    });
  });

  it("keeps an owner's draft a draft", async () => {
    const code = await createFormat({ ...owner, body: { format: "self", proposedAmount: 2900 } });
    expect(offerRow(code)).toMatchObject({
      amount: null,
      proposed_amount: 2900,
      review_status: "draft",
      active: false,
    });
  });

  it("refuses to put a checkout on sale with no price — and writes nothing", async () => {
    const before = db.rows("experience_offers").length;
    await expectFormatError(
      createFormat({ ...owner, body: { format: "self", submit: true } }),
      "format_invalid_amount",
    );
    expect(db.rows("experience_offers")).toHaveLength(before);
  });

  it("replaces the live price of a format on sale at once", async () => {
    await updateFormat({ ...owner, code: "way21-group", body: { proposedAmount: 5200, label: "Потік 2" } });
    expect(offerRow("way21-group")).toMatchObject({
      amount: 5200,
      proposed_amount: null,
      review_status: "approved",
      active: true,
      label: { uk: "Потік 2", en: "Потік 2" },
    });
  });

  it("accepts a waiting proposal when the owner saves it as the price", async () => {
    offerRow("way21-group").proposed_amount = 5200;
    await updateFormat({ ...owner, code: "way21-group", body: { proposedAmount: 5200 } });
    expect(offerRow("way21-group")).toMatchObject({ amount: 5200, proposed_amount: null });
  });

  it("sends a draft straight to sale", async () => {
    offerRow("way21-group").review_status = "draft";
    offerRow("way21-group").active = false;
    await updateFormat({ ...owner, code: "way21-group", body: { proposedAmount: 3000, submit: true } });
    expect(offerRow("way21-group")).toMatchObject({ amount: 3000, review_status: "approved", active: true });
  });

  it("leaves `support` — admin surface, not prices — on the proposal path", async () => {
    await updateFormat({ ...admin, code: "way21-group", body: { proposedAmount: 5200 } });
    expect(offerRow("way21-group")).toMatchObject({ amount: 4800, proposed_amount: 5200 });
  });
});
