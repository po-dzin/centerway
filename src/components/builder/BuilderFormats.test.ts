/**
 * BuilderFormats — the builder's «Формати й набори».
 *
 * Guards two things:
 *  - the «Що входить» parsing (`inputOf`): one point per line, leading
 *    bullets «- • · *» stripped, blank lines dropped, at most 12 points of at
 *    most 160 chars; the price must be a positive whole number; a format that is
 *    already on sale and edited by a non-owner sends only the wording, never
 *    kind / mode / start / bundle; a start date only travels with a group;
 *  - the list and editor as rendered: each format with its price, status line,
 *    features (or the «not filled» note) and included programs; the editor
 *    pre-fills «Що входить» one feature per line; linked programs listed.
 *
 * The list arrives through `useEffect` in the real component, which a static
 * render never runs — so the render tests seed the component's `useState`
 * slots directly (see the `react` mock below).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { BuilderFormatDto, BuilderFormatsDto } from "./builderClient";
import type { Course } from "@/lms-core";

/* Values for BuilderFormats' own useState calls, in declaration order:
   read, editing, draft, busy, adding. Consumed by the parent's first render
   only; children (ChoiceRow etc.) fall through to the real hook. */
const seeded = vi.hoisted(() => ({ queue: [] as unknown[] }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (init: unknown) => (seeded.queue.length > 0 ? [seeded.queue.shift(), () => {}] : actual.useState(init)),
  };
});
vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ success: () => {}, error: () => {}, info: () => {}, warning: () => {} }),
}));
vi.mock("./builderClient", () => ({
  loadCourseFormats: vi.fn(async () => ({ ok: false })),
  createCourseFormat: vi.fn(),
  updateCourseFormat: vi.fn(),
  deleteCourseFormat: vi.fn(),
}));

const { BuilderFormats, draftOf, inputOf } = await import("./BuilderFormats");

function dto(overrides: Partial<BuilderFormatDto> & Pick<BuilderFormatDto, "code" | "format">): BuilderFormatDto {
  return {
    label: "Самостійно",
    labelIsDefault: true,
    summary: "",
    features: [],
    mode: "checkout",
    amount: 1500,
    proposedAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    reviewStatus: "approved",
    active: true,
    includes: [],
    ...overrides,
  };
}

type Draft = ReturnType<typeof draftOf>;
function draft(overrides: Partial<Draft> = {}): Draft {
  return { ...draftOf(null), ...overrides };
}

describe("inputOf — «Що входить» parsing", () => {
  it("turns one point per line into features, stripping bullets and dropping blank lines", () => {
    const input = inputOf(
      draft({
        features: "- Усе з формату «Самостійно»\n\n• Закрита група\n  · Ефіри щотижня  \n* Звіти\n   \nБез маркера",
      }),
      false,
    );
    expect(input).not.toHaveProperty("error");
    expect((input as { features: string[] }).features).toEqual([
      "Усе з формату «Самостійно»",
      "Закрита група",
      "Ефіри щотижня",
      "Звіти",
      "Без маркера",
    ]);
  });

  it("keeps a dash inside a line and strips only the leading bullet", () => {
    const input = inputOf(draft({ features: "- 21 день — щодня урок" }), false) as { features: string[] };
    expect(input.features).toEqual(["21 день — щодня урок"]);
  });

  it("gives an empty list for an empty textarea", () => {
    expect((inputOf(draft({ features: "  \n\n" }), false) as { features: string[] }).features).toEqual([]);
  });

  it("accepts 12 points and refuses 13", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `Пункт ${i + 1}`).join("\n");
    expect((inputOf(draft({ features: twelve }), false) as { features: string[] }).features).toHaveLength(12);
    expect(inputOf(draft({ features: `${twelve}\nЩе один` }), false)).toEqual({
      error: "Не більше 12 пунктів у списку",
    });
    // Blank lines do not count towards the limit.
    expect(inputOf(draft({ features: `${twelve}\n\n\n` }), false)).not.toHaveProperty("error");
  });

  it("accepts a 160-char point and refuses 161", () => {
    expect(inputOf(draft({ features: "а".repeat(160) }), false)).not.toHaveProperty("error");
    expect(inputOf(draft({ features: "а".repeat(161) }), false)).toEqual({ error: "Пункт списку — до 160 символів" });
    // The bullet is stripped before measuring.
    expect(inputOf(draft({ features: `- ${"а".repeat(160)}` }), false)).not.toHaveProperty("error");
  });

  it("requires a positive whole price, and sends null when none is proposed", () => {
    for (const bad of ["0", "-5", "12.5", "abc"]) {
      expect(inputOf(draft({ proposedAmount: bad }), false)).toEqual({
        error: "Ціна — ціле число гривень, більше нуля",
      });
    }
    expect((inputOf(draft({ proposedAmount: " 3900 " }), false) as { proposedAmount: number }).proposedAmount).toBe(
      3900,
    );
    expect((inputOf(draft({ proposedAmount: "" }), false) as { proposedAmount: null }).proposedAmount).toBeNull();
  });

  it("sends the cohort start only for a group format", () => {
    expect(inputOf(draft({ format: "group", cohortStartsOn: "2026-10-01" }), false)).toMatchObject({
      cohortStartsOn: "2026-10-01",
    });
    expect(inputOf(draft({ format: "group", cohortStartsOn: "" }), false)).toMatchObject({ cohortStartsOn: null });
    expect(inputOf(draft({ format: "self", cohortStartsOn: "2026-10-01" }), false)).toMatchObject({
      cohortStartsOn: null,
    });
  });

  it("sends only the wording for a locked (approved, non-owner) format", () => {
    const input = inputOf(
      draft({ format: "group", mode: "lead", cohortStartsOn: "2026-10-01", includes: ["reset-day"], features: "А" }),
      true,
    );
    expect(Object.keys(input).sort()).toEqual(["features", "label", "proposedAmount", "summary"]);
  });
});

describe("draftOf", () => {
  it("joins features one per line and hides a default label", () => {
    const d = draftOf(
      dto({
        code: "g",
        format: "group",
        features: ["Перший", "Другий"],
        includes: [{ slug: "reset-day", title: "Reset Day" }],
        proposedAmount: 4200,
        cohortStartsOn: "2026-10-01",
      }),
    );
    expect(d.features).toBe("Перший\nДругий");
    expect(d.label).toBe("");
    expect(d.includes).toEqual(["reset-day"]);
    expect(d.proposedAmount).toBe("4200");
    expect(d.cohortStartsOn).toBe("2026-10-01");
    // Round trip: the draft parses back to the same features.
    expect((inputOf(d, false) as { features: string[] }).features).toEqual(["Перший", "Другий"]);
  });

  it("keeps an author-written label, and defaults a new format to a group checkout", () => {
    expect(draftOf(dto({ code: "s", format: "self", label: "Сам", labelIsDefault: false })).label).toBe("Сам");
    expect(draftOf(null)).toMatchObject({ format: "group", mode: "checkout", features: "", includes: [] });
  });
});

const COURSE = {
  slug: "way21",
  modules: [
    { id: "m1", slug: "week-1", title: "Тиждень 1", order: 1, lessons: [] },
    {
      id: "m2",
      slug: "reset-day",
      title: "Розвантажувальний день",
      order: 2,
      reference: true,
      linkedCourseSlug: "reset-day",
      lessons: [],
    },
  ],
} as unknown as Course;

const DATA: BuilderFormatsDto = {
  isOwner: false,
  includable: [
    { slug: "reset-day", title: "Розвантажувальний день", status: "published" },
    { slug: "short", title: "Short", status: "published" },
    { slug: "wip", title: "Чернетка", status: "draft" },
  ],
  formats: [
    dto({ code: "course:way21", format: "self", features: ["21 урок", "Довідкові матеріали"] }),
    dto({
      code: "way21_group",
      format: "group",
      label: "Потік з друзями",
      labelIsDefault: false,
      amount: null,
      proposedAmount: 3900,
      reviewStatus: "proposed",
      cohortStartsOn: "2026-10-01",
      includes: [
        { slug: "reset-day", title: "Розвантажувальний день" },
        { slug: "short", title: "Short" },
      ],
    }),
    dto({
      code: "way21_ind",
      format: "individual",
      label: "Супровід",
      mode: "lead",
      amount: null,
      reviewStatus: "draft",
    }),
  ],
};

function renderWith(state: {
  data: BuilderFormatsDto | null;
  editing?: string | null;
  draftFrom?: BuilderFormatDto | null;
}) {
  seeded.queue = [
    { slug: COURSE.slug, data: state.data, failed: false },
    state.editing ?? null,
    draftOf(state.draftFrom ?? null),
    false,
    "",
  ];
  const html = renderToStaticMarkup(createElement(BuilderFormats, { course: COURSE, onChange: () => {} }));
  seeded.queue = [];
  return html;
}

describe("BuilderFormats — render", () => {
  it("shows «Завантаження…» before the formats have been read, and lists linked programs", () => {
    const html = renderToStaticMarkup(createElement(BuilderFormats, { course: COURSE, onChange: () => {} }));
    expect(html).toContain("Завантаження…");
    expect(html).toContain("Програми всередині");
    expect(html).toContain("Розвантажувальний день");
  });

  it("lists each format with its price, status, features and included programs", () => {
    const html = renderWith({ data: DATA });
    // Self: approved, features listed.
    expect(html).toContain("У продажу");
    expect(html).toContain("1&nbsp;500 ₴".replace("&nbsp;", " "));
    expect(html).toContain("21 урок");
    expect(html).toContain("Довідкові матеріали");
    // Group: author label + kind, proposal, start date, bundle.
    expect(html).toContain("Потік з друзями");
    expect(html).toContain("Група потоку · На погодженні · старт 1 жовтня · пропозиція 3 900 ₴");
    expect(html).toContain("Також відкриває: <strong>Розвантажувальний день · Short</strong>");
    // A format without features says so.
    expect(html).toContain("Список «що входить» ще не заповнено");
    // Lead without a price.
    expect(html).toContain("за запитом");
    expect(html).toContain("через заявку");
    // Only the published, not-yet-linked program is offered to link.
    expect(html).toContain('<option value="short">Short</option>');
    expect(html).not.toContain('<option value="reset-day"');
    expect(html).not.toContain('<option value="wip"');
  });

  it("pre-fills «Що входить» one feature per line in the editor", () => {
    const self = DATA.formats[0]!;
    const html = renderWith({ data: DATA, editing: self.code, draftFrom: self });
    expect(html).toContain("Що входить");
    expect(html).toMatch(/<textarea[^>]*>21 урок\nДовідкові матеріали<\/textarea>/);
    // Approved and not the owner: locked — kind, mode and bundle are the owner's.
    expect(html).toContain("Формат уже продається");
    expect(html).toContain("Нова ціна, яку пропонуєте, ₴");
    expect(html).toContain("Зберегти й надіслати");
    expect(html).not.toContain("Зберегти чернетку");
  });

  it("opens a full editor for a new format with the published programs to include", () => {
    const html = renderWith({ data: DATA, editing: "new" });
    expect(html).toContain("Новий формат");
    expect(html).toContain("Також відкриває");
    expect(html).toContain("Старт потоку");
    expect(html).toContain("Надіслати на погодження");
    expect(html).toContain("Зберегти чернетку");
    expect(html).not.toContain("Чернетка</"); // the draft program is not includable
  });
});
