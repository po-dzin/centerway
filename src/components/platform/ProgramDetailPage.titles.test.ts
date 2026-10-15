/**
 * ProgramDetailPage — the author's own block titles, the dashed route and the
 * price inside the buy button (G, 2026-10-15).
 *
 *  - a course that wrote `sectionTitles` prints them as the titles of the method,
 *    shape and facet blocks, with the shared small line («Для кого», «Що
 *    зміниться», «Що входить») kept above each facet title;
 *  - a course that wrote none reads exactly as before: generic titles, no extra
 *    line above the facets;
 *  - the mobile bar's button carries the price («Оплатити 1 500 ₴»), and the
 *    separate price block is gone;
 *  - the seam's thread is the system's dashed rail and the route is as wide as
 *    the card above it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
  audience: ["Ви вже чистились"],
  format: ["Три фази"],
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

const TITLES = {
  method: "Очищення, після якого звички лишаються",
  shape: "Три фази за двадцять один день",
  audience: "Якщо «чистки» не трималися",
  results: "Що зміниться за двадцять один день",
  included: "Фітопротокол, режим і вебінари",
};

async function render(program: OfferSurface) {
  const { ProgramDetailPage } = await import("./ProgramDetailPage");
  return renderToStaticMarkup(createElement(ProgramDetailPage, { program, commerce: COMMERCE, course: WAY21 }));
}

describe("ProgramDetailPage — block titles", () => {
  it("prints the author's titles and keeps the shared line above each facet", async () => {
    const html = await render({ ...PROGRAM, sectionTitles: TITLES });
    for (const title of Object.values(TITLES)) expect(html).toContain(title);
    // The shared lines stay as the small line above the facet titles.
    for (const label of ["Для кого", "Що зміниться", "Що входить"]) expect(html).toContain(label);
    expect(html).toContain("Про метод");
    expect(html).toContain("Як побудовано");
    expect(html).not.toContain("Коротко про результат");
  });

  it("falls back to the generic titles when none were written", async () => {
    const html = await render(PROGRAM);
    expect(html).toContain("Коротко про результат");
    expect(html).toContain("День за днем");
    for (const title of Object.values(TITLES)) expect(html).not.toContain(title);
  });
});

describe("ProgramDetailPage — price in the button", () => {
  it("puts the price in the mobile bar's button and drops the separate price", async () => {
    const html = await render(PROGRAM);
    expect(html).toContain(`Оплатити ${formatPrice(1500, "UAH")}`);
    expect(html).not.toContain("stickyPrice");
  });
});

describe("OfferSeam — the route", () => {
  const css = readFileSync(path.resolve(__dirname, "OfferSeam.module.css"), "utf8");

  it("draws the thread as the system's 1.5px dashed rail", () => {
    expect(css).toMatch(/border-block-start:\s*1\.5px dashed/);
    expect(css).not.toMatch(/background:\s*var\(--cw-mat-stroke-inner\);\s*\}/);
  });

  it("is as wide as the card above it", () => {
    expect(css).toMatch(/\.route\s*\{[^}]*inline-size:\s*100%/);
  });
});
