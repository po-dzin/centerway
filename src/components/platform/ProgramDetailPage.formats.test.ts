/**
 * ProgramDetailPage — formats and the course-shape panel (2026-09-25).
 *
 * Guards, rendering the whole page on the real Шлях 21 course:
 *  - with 2+ formats the hero quotes «від <lowest checkout price>» (a lead
 *    format without a price never wins), leads to #formats with «Обрати формат»,
 *    and the enrol section is the formats block, not the single checkout;
 *  - with one format or none the page is the single offer it always was;
 *  - the course-shape panel is labelled «Як побудовано», counts protocol lessons
 *    only (reference modules excluded), says the rhythm from `course.schedule`
 *    (daily soft / daily hard / sequential / open), names the reference
 *    materials separately, and never says «без переходу на лендинг».
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProgramFormat } from "@/lib/experiences/formats";
import type { OfferCommerce } from "@/lib/platform/offerCommerce";
import type { OfferSurface } from "@/lib/platform/offerSurface";
import { formatPrice } from "@/lib/products";
import type { Course } from "@/lms-core";

vi.mock("next/navigation", () => ({
  usePathname: () => "/programs/way21",
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const WAY21 = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../data/courses/way21.json"), "utf8"),
) as unknown as Course;

const PROGRAM: OfferSurface = {
  slug: "way21",
  title: "Шлях 21",
  fullTitle: "Шлях 21 — програма очищення",
  tag: "Програма",
  duration: "21 день",
  description: "Три тижні протоколу.",
  longDescription: "Довгий опис методу.",
  results: ["Легкість"],
  surfaceType: "program",
};

const COMMERCE: OfferCommerce = {
  mode: "checkout",
  productCode: "course:way21" as never,
  checkoutHref: "/api/pay/start?product=course%3Away21",
  price: formatPrice(1500, "UAH"),
  compareAtPrice: null,
  amount: 1500,
  currency: "UAH",
};

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

const FORMATS: ProgramFormat[] = [
  fmt({ code: "way21_group", format: "group", label: "У групі потоку", amount: 3900 }),
  fmt({ code: "course:way21", format: "self", label: "Самостійно", amount: 1200 }),
  fmt({ code: "way21_individual", format: "individual", label: "Індивідуальний супровід", mode: "lead", amount: null }),
];

async function render(props: { formats?: ProgramFormat[]; course?: Course | null } = {}) {
  const { ProgramDetailPage } = await import("./ProgramDetailPage");
  return renderToStaticMarkup(
    createElement(ProgramDetailPage, { program: PROGRAM, commerce: COMMERCE, course: WAY21, ...props }),
  );
}

function withSchedule(schedule: Record<string, unknown>): Course {
  return { ...WAY21, schedule: { ...WAY21.schedule, ...schedule } } as Course;
}

describe("ProgramDetailPage — formats", () => {
  it("with 2+ formats quotes the lowest checkout price and leads to #formats", async () => {
    const html = await render({ formats: FORMATS });
    expect(html).toContain(`від ${formatPrice(1200, "UAH")}`);
    expect(html).not.toContain(`від ${formatPrice(3900, "UAH")}`);
    expect(html).toContain('href="#formats"');
    expect(html).toContain("Обрати формат");
    // The enrol section is the formats block, not the single checkout panel.
    expect(html).toContain('id="formats"');
    expect(html).not.toContain(`Відкрити доступ до «Шлях 21»`);
  });

  it("with one format stays the single offer", async () => {
    const html = await render({ formats: [FORMATS[1]!] });
    expect(html).not.toContain('id="formats"');
    expect(html).not.toContain("Обрати формат");
    expect(html).not.toContain(`від ${formatPrice(1200, "UAH")}`);
    expect(html).toContain("Відкрити доступ до «Шлях 21»");
    expect(html).toContain(COMMERCE.checkoutHref.replace(/&/g, "&amp;"));
  });

  it("with no formats stays the single offer", async () => {
    const html = await render();
    expect(html).not.toContain('id="formats"');
    expect(html).toContain("Купити");
  });
});

describe("ProgramDetailPage — «Як побудовано»", () => {
  it("labels the course-shape panel «Як побудовано», not «Формат», and never mentions the landing", async () => {
    const html = await render({ formats: FORMATS });
    expect(html).toContain("Як побудовано");
    expect(html).not.toContain("без переходу на лендинг");
  });

  it("counts protocol lessons only and names the reference materials separately", async () => {
    // way21: 11 protocol lessons, 5 in «Матеріали» (reference), 2 linked modules with none.
    const html = await render();
    expect(html).toContain("11 уроків");
    expect(html).toContain("Окремо від уроків — 5 довідкових матеріалів");
  });

  it("omits the reference line when the course has no reference lessons", async () => {
    const plain = { ...WAY21, modules: WAY21.modules.filter((m) => !m.reference) } as Course;
    const html = await render({ course: plain });
    expect(html).not.toContain("Окремо від уроків");
    expect(html).toContain("11 уроків");
  });

  it("says the rhythm from the course schedule", async () => {
    expect(await render({ course: withSchedule({ mode: "daily", gate: undefined }) })).toContain(
      "Кожен урок має свій день; наперед можна зазирнути будь-коли",
    );
    const hard = await render({ course: withSchedule({ mode: "daily", gate: "hard" }) });
    expect(hard).toContain("Щодня відкривається урок свого дня — від дати старту");
    expect(hard).toContain("День за днем");

    const sequential = await render({ course: withSchedule({ mode: "sequential" }) });
    expect(sequential).toContain("Уроки відкриваються по черзі, у вашому темпі");
    expect(sequential).toContain("У своєму темпі");

    expect(await render({ course: withSchedule({ mode: "open" }) })).toContain(
      "Усі уроки відкриті одразу — у вашому темпі",
    );
  });
});
