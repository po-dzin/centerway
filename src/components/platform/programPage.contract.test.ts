/**
 * Contract for the program page changes of 2026-10-15 (G): the author's own
 * block titles, the dashed route at card width, and the price inside the buy
 * button. Source-text invariants only — the repo has no component-test harness
 * (AGENTS.md, «Component tests: none, on purpose»), so what shows on screen is
 * the browser smoke's and the design gates' job.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");

describe("program page — the author's block titles", () => {
  const page = read("ProgramDetailPage.tsx");

  it("reads every block title from sectionTitles and keeps the generic one as the fallback", () => {
    expect(page).toMatch(/program\.sectionTitles\?\.method\s*\?\?/);
    expect(page).toMatch(/program\.sectionTitles\?\.shape\s*\?\?/);
    expect(page).toContain("titles={program.sectionTitles}");
    expect(page).toContain("Коротко про результат");
    expect(page).toContain("Що дає цей короткий вхід");
  });

  it("keeps the shared line above each facet and prints it only above an authored title", () => {
    const facets = read("OfferFacets.tsx");
    for (const label of ["Для кого", "Що зміниться", "Що входить"]) {
      expect(facets).toMatch(new RegExp(`label: "${label}", title: titles\\?\\.\\w+ \\?\\? "${label}"`));
    }
    expect(facets).toContain("facet.title === facet.label");
  });

  it("ships titles for the four approved programs in the data and the migration", () => {
    const migration = read("../../../supabase/migrations/20261015120000_course_section_titles.sql");
    for (const slug of ["short", "way21", "reset-day", "natural-body"]) {
      const course = JSON.parse(read(`../../../data/courses/${slug}.json`)) as {
        sectionTitles?: Record<string, string>;
      };
      expect(Object.keys(course.sectionTitles ?? {}).sort()).toEqual(
        ["audience", "included", "method", "results", "shape"].sort(),
      );
      expect(migration).toContain(`slug = '${slug}' and section_titles is null`);
    }
  });
});

describe("program page — the price in the button", () => {
  const bar = read("OfferStickyBar.tsx");

  it("composes the label from the verb and the price, and no longer prints the price beside the button", () => {
    expect(bar).toContain("`Оплатити ${price}`");
    expect(bar).toContain("`${buyLabel} · ${price}`");
    expect(bar).not.toContain("stickyPrice");
    expect(read("PlatformOfferCommerce.module.css")).not.toContain(".stickyPrice");
  });

  it("shows no price on a free offer", () => {
    expect(read("ProgramDetailPage.tsx")).toContain("price={isFree && !choosesFormat ? null : heroPrice}");
  });
});

describe("program page — the route", () => {
  const css = read("OfferSeam.module.css");

  it("draws the thread as the system's 1.5px dashed rail", () => {
    expect(css).toMatch(/border-block-start:\s*1\.5px dashed/);
  });

  it("is as wide as the card above it", () => {
    expect(css).toMatch(/\.route\s*\{[^}]*inline-size:\s*100%/);
  });
});
