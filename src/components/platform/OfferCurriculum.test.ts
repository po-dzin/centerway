/**
 * OfferCurriculum — the course outline on a program page, in its reader states.
 *
 * Guards, on the real Шлях 21 course (`data/courses/way21.json`):
 *  - a reader who has not bought (unknown / none) sees every lesson title with
 *    a list dot, NO padlock per row, and exactly one padlock per lesson module
 *    labelled «Відкривається після оплати»; no lesson links to the reader;
 *  - an owner sees ✓ on done lessons, ▶ on the current one, a schedule note on
 *    a lesson the schedule still shuts, and links into the reader;
 *  - a linked module (`linkedCourseSlug`, no lessons) is a «Бонус» card whose
 *    title links to the program page when a format includes it and which names
 *    the formats that open it — or says a generic sentence when none do.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OfferAccess } from "@/components/platform/OfferAccess";
import type { ProgramFormat } from "@/lib/experiences/formats";
import type { Course } from "@/lms-core";

const access = vi.hoisted(() => ({ current: { state: "unknown" } as unknown }));

vi.mock("@/components/platform/OfferAccess", () => ({
  useOfferAccess: () => access.current,
}));
vi.mock("@/components/platform/layout/SurfaceHost", () => ({
  useSurfaceHref: () => (p: string) => `https://my.test${p}`,
}));

const WAY21 = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../data/courses/way21.json"), "utf8"),
) as unknown as Course;

const LESSON_MODULES = WAY21.modules.filter((m) => !m.linkedCourseSlug);
const LESSON_COUNT = LESSON_MODULES.reduce((n, m) => n + m.lessons.length, 0);

function fmt(overrides: Partial<ProgramFormat> & Pick<ProgramFormat, "code" | "format" | "label">): ProgramFormat {
  return {
    summary: null,
    features: [],
    mode: "checkout",
    amount: 1500,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    includes: [],
    ...overrides,
  };
}

const RESET_DAY = {
  courseSlug: "reset-day",
  programSlug: "reset-day-program",
  title: "Reset Day",
  kind: "mini" as const,
};

const FORMATS: ProgramFormat[] = [
  fmt({ code: "course:way21", format: "self", label: "Самостійно" }),
  fmt({ code: "way21_group", format: "group", label: "У групі потоку", includes: [RESET_DAY] }),
  fmt({
    code: "way21_individual",
    format: "individual",
    label: "Індивідуальний супровід",
    mode: "lead",
    amount: null,
    includes: [RESET_DAY],
  }),
];

async function render(props: { formats?: ProgramFormat[]; landingHref?: string | null } = {}) {
  const { OfferCurriculum } = await import("./OfferCurriculum");
  return renderToStaticMarkup(createElement(OfferCurriculum, { course: WAY21, ...props }));
}

function count(html: string, needle: string | RegExp): number {
  return (
    html.match(needle instanceof RegExp ? needle : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []
  ).length;
}

beforeEach(() => {
  access.current = { state: "unknown" } satisfies OfferAccess;
});

describe("OfferCurriculum — a reader who has not bought", () => {
  for (const state of ["unknown", "none"] as const) {
    it(`(${state}) lists every lesson with a dot, one padlock per lesson module, no reader links`, async () => {
      access.current = { state };
      const html = await render({ formats: FORMATS });

      expect(html).toContain('id="program-plan"');
      for (const lessonModule of LESSON_MODULES) {
        for (const lesson of lessonModule.lessons) expect(html).toContain(lesson.title.replace(/'/g, "&#x27;"));
      }
      expect(count(html, 'data-state="locked"')).toBe(LESSON_COUNT);
      // Every row a dot, no icon per row.
      expect(count(html, 'aria-hidden="true"></span>')).toBeGreaterThanOrEqual(LESSON_COUNT);
      // One padlock per lesson module, none on linked (bonus) modules.
      expect(count(html, "Відкривається після оплати")).toBe(LESSON_MODULES.length);
      expect(html).not.toContain("/learn/way21/");
    });
  }
});

describe("OfferCurriculum — an owner", () => {
  it("ticks done lessons, marks the current one, notes a scheduled lock, and links into the reader", async () => {
    const entry = (slug: string, extra: Record<string, unknown>) => ({
      moduleId: "m",
      moduleTitle: "m",
      isReference: false,
      lessonId: slug,
      slug,
      title: slug,
      dayIndex: null,
      durationMin: null,
      completed: false,
      availability: { available: true },
      ...extra,
    });
    access.current = {
      state: "owned",
      shelf: { currentLessonSlug: "w1-nutrition" },
      outline: [
        entry("intro", { completed: true }),
        entry("w1-instruction", { completed: true }),
        entry("w1-nutrition", {}),
        entry("w1-morning", {
          availability: { available: false, reason: "locked_by_day", unlocksOnDay: 3, daysRemaining: 1 },
        }),
        entry("w1-review", {
          availability: { available: false, reason: "locked_by_day", unlocksOnDay: 7, daysRemaining: 5 },
        }),
        entry("w2-instruction", {
          availability: { available: false, reason: "locked_by_sequence", requiresLessonId: "x" },
        }),
      ],
    };
    const html = await render({ formats: FORMATS });

    expect(html).not.toContain("Відкривається після оплати");
    expect(count(html, 'data-state="done"')).toBe(2);
    expect(count(html, 'data-state="current"')).toBe(1);
    expect(count(html, 'data-state="locked"')).toBe(3);
    expect(html).toContain("відкриється завтра");
    expect(html).toContain("відкриється через 5 дн.");
    expect(html).toContain("спершу завершіть попередній урок");
    // Open lessons link into the reader through the surface resolver; locked ones do not.
    expect(html).toContain('href="https://my.test/learn/way21/w1-nutrition"');
    expect(html).toContain('href="https://my.test/learn/way21/w2-herbs"');
    expect(html).not.toContain('href="https://my.test/learn/way21/w1-morning"');
  });

  it("opens every lesson (no padlocks) while the per-lesson outline has not landed", async () => {
    access.current = { state: "owned", shelf: { currentLessonSlug: null }, outline: null };
    const html = await render();
    expect(count(html, 'data-state="open"')).toBe(LESSON_COUNT);
    expect(html).not.toContain("Відкривається після оплати");
  });
});

describe("OfferCurriculum — linked modules", () => {
  it("renders a linked module as a «Бонус» card naming the formats that open it, linked to its program", async () => {
    const html = await render({ formats: FORMATS });
    const linked = WAY21.modules.filter((m) => m.linkedCourseSlug);
    expect(linked).toHaveLength(2);

    expect(count(html, "Бонус")).toBe(2);
    // Reset Day is in two formats: linked and named.
    expect(html).toContain('href="/programs/reset-day-program"');
    expect(html).toContain("Розвантажувальний день");
    expect(html).toContain("Окремий міні-курс у форматах «У групі потоку» і «Індивідуальний супровід»");
    // Short is in no format: plain title, generic sentence.
    expect(html).toContain("Short-Перезавантаження");
    expect(html).not.toContain('href="/programs/short"');
    expect(html).toContain("Окремий міні-курс, відкривається разом з особливими форматами програми");
  });

  it("says the generic sentence on every bonus card when no formats are passed", async () => {
    const html = await render();
    expect(count(html, "Окремий міні-курс, відкривається разом з особливими форматами програми")).toBe(2);
    expect(html).not.toContain("/programs/");
  });
});

describe("OfferCurriculum — landing link", () => {
  it("offers the long landing only when one is given", async () => {
    expect(await render({ landingHref: "https://way21.example/" })).toContain('href="https://way21.example/"');
    expect(await render()).not.toContain("Дізнатися більше");
  });
});
