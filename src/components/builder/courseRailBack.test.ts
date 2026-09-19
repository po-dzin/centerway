import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
/**
 * The declarations of one rule, found by its selector at the START of a line (every such block) —
 * so `.courseRailNav` is the top-level rule, not the compact rail's
 * `.aside[data-compact] .courseRailNav` that also ends with it. Pass the
 * indentation for a rule nested in a media query.
 */
const rule = (source: string, selector: string) => {
  const head = `\n${selector} {`;
  const blocks: string[] = [];
  // Every block with this selector: a rule split across the file (colour in
  // one place, geometry in another) is still one rule.
  for (let at = source.indexOf(head); at >= 0; at = source.indexOf(head, at + 1)) {
    const start = at + head.length;
    blocks.push(source.slice(start, source.indexOf("}", start)));
  }
  return blocks.join("\n");
};

/**
 * THE WAY OUT, IN WORDS, WHERE THE HAND IS (2026-09-19). Every level of the
 * workshop opens its left panel with the way one level up: the lesson's
 * contents with «← Структура курсу», the course rail with «← Матеріали». The
 * breadcrumb in the bar was the only other way, at the far top of the screen.
 */
describe("the workshop's left panels open with the way back", () => {
  const rail = read("src/components/builder/BuilderModuleEditor.tsx");
  const css = read("src/components/builder/Builder.module.css");

  it("opens the course rail with a link to the shelf, above the sections", () => {
    const back = rail.indexOf("styles.courseRailBack");
    const nav = rail.indexOf('aria-label="Розділи курсу"');
    expect(back).toBeGreaterThan(-1);
    expect(back).toBeLessThan(nav);
    expect(rail).toContain("href={BUILDER_COURSES_PATH}");
    expect(rail).toContain("<BuilderInkLabel>Матеріали</BuilderInkLabel>");
    // Named for the icon-only compact rail, where the word is hidden.
    expect(rail).toContain('aria-label="До всіх матеріалів"');
    // A link, not a button: the shell's unsaved-changes guard intercepts anchors.
    expect(rail).toMatch(/<Link\s+className=\{`cw-nav-link \$\{styles\.courseRailBack\}`\}/);
  });

  it("keeps the lesson's contents opening one level up", () => {
    const contents = read("src/components/builder/BuilderContents.tsx");
    expect(contents).toContain("onNavigate(`/build/${course.slug}`)");
    expect(contents).toContain("<InkLabel>Структура курсу</InkLabel>");
  });

  it("stands the arrow in the sections' icon column and the word on their labels' edge", () => {
    const back = rule(css, ".courseRailBack");
    const link = rule(css, ".courseRailLink");
    expect(back).toContain("grid-template-columns: 1.5rem minmax(0, 1fr)");
    expect(link).toContain("grid-template-columns: 1.5rem minmax(0, 1fr)");
    expect(back).toContain("min-height: var(--ds-button-min-height)");
  });

  it("keeps only the arrow in the compact rail", () => {
    expect(css).toContain(".aside[data-compact] .courseRailBack > .inkLabel,");
    expect(rule(css, "  .aside[data-compact] .courseRailBack")).toContain("justify-items: center");
  });

  it("does not move the workshop rail, which has no way back to show", () => {
    expect(rule(css, ".courseRailNav")).toContain("padding-block-start: var(--cw-space-2xl)");
    expect(rule(css, ".courseRailBack + .courseRailNav")).toContain("padding-block-start: var(--cw-space-xl)");
    expect(read("src/components/builder/BuilderWorkshopRail.tsx")).not.toContain("courseRailBack");
  });
});
