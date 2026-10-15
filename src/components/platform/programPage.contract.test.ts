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

  it("draws the thread as a 2px rail, 6 on and 5 off (G, 2026-10-15)", () => {
    expect(css).toMatch(/block-size:\s*2px/);
    expect(css).toMatch(/repeating-linear-gradient\([^)]*var\(--seam-thread\) 0 6px,\s*transparent 6px 11px\)/);
  });

  it("stands exactly between the two blocks: one gap above and below", () => {
    expect(css).toMatch(
      /margin-block:\s*calc\(var\(--seam-gap\) - 2 \* var\(--platform-anchor-inset\)\)\s+var\(--seam-gap\)/,
    );
  });

  it("is as wide as the card above it", () => {
    expect(css).toMatch(/\.route\s*\{[^}]*inline-size:\s*100%/);
  });
});

describe("floating actions — no plate under them (G, 2026-10-15)", () => {
  it("the offer's sticky bar is a transparent row; only the button takes pointer events", () => {
    const css = read("PlatformOfferCommerce.module.css");
    const bar = css.slice(css.indexOf("@media (max-width: 900px)"));
    expect(bar).toMatch(/\.stickyBar\s*\{[^}]*background:\s*transparent/);
    expect(bar).toMatch(/\.stickyBar\s*\{[^}]*pointer-events:\s*none/);
    expect(bar).not.toMatch(/\.stickyBar\s*\{[^}]*--cw-mat-surface\b/);
    expect(css).toMatch(/\.stickyAction\s*\{[^}]*pointer-events:\s*auto/);
  });

  it("the reader's round button wears the topbar's glass", () => {
    const css = read("../lms/Lms.module.css");
    const button = css.slice(css.indexOf(".topButton {"), css.indexOf(".topButton[data-shown"));
    expect(button).toContain("background-color: var(--cw-mat-tint-chrome)");
    expect(button).toContain("backdrop-filter: var(--cw-mat-filter)");
  });
});

describe("program page — the stages line (G, 2026-10-15)", () => {
  it("shows the program's stages as the shared step line, and keeps the list without them", () => {
    const page = read("ProgramDetailPage.tsx");
    expect(page).toContain("programStages(course)");
    expect(page).toMatch(/stages \?\s*\(\s*<StepLine/);
    expect(page).toContain("<PlatformOfferMetaList items={formatMeta} />");
  });

  it("draws the step line in the route's terms: 2px thread, 6 on and 5 off, gold behind", () => {
    const css = read("StepLine.module.css");
    expect(css).toMatch(/inline-size:\s*2px/);
    expect(css).toMatch(/repeating-linear-gradient\(to bottom, var\(--step-thread\) 0 6px, transparent 6px 11px\)/);
    expect(css).toMatch(/\[data-state="done"\]::after\s*\{\s*--step-thread:\s*var\(--cw-platform-accent\)/);
  });
});
