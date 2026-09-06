import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
const rule = (source: string, selector: string) => {
  const at = source.indexOf(`${selector} {`);
  if (at < 0) return "";
  return source.slice(at, source.indexOf("}", at));
};

/**
 * ONE SHEET, THREE SURFACES.
 *
 * The reader's contents, the reader's note editor and the workshop's contents
 * are the same object — a panel that rises from the bottom edge over a shield —
 * and they were three recipes: two ceilings, two measures, one handle between
 * them, one that scrolled and one that could grow past the top of the screen.
 *
 * The workshop's TOOL panel is deliberately not in this list; see the note over
 * the recipe for why a panel you can work behind must not look like a modal.
 */
describe("bottom sheet", () => {
  const recipe = "src/components/platform/layout/BottomSheet.module.css";

  it("is composed by every sheet that opens over a shield", () => {
    const lms = read("src/components/lms/Lms.module.css");
    expect(rule(lms, ".drawer")).toContain('composes: sheet from "../platform/layout/BottomSheet.module.css"');
    expect(rule(lms, ".noteEditor")).toContain('composes: sheet from "../platform/layout/BottomSheet.module.css"');
    expect(rule(read("src/components/builder/Builder.module.css"), ".asideSheet"))
      .toContain('composes: sheet from "../platform/layout/BottomSheet.module.css"');
  });

  it("keeps the two axes a caller may set, and only those", () => {
    const sheet = rule(read(recipe), ".sheet");
    expect(sheet).toContain("var(--sheet-measure, 34rem)");
    expect(sheet).toContain("var(--sheet-ceiling, 82svh)");
    // The note editor is the one that needs a narrower measure — a paragraph
    // being written, not a list of lessons.
    expect(rule(read("src/components/lms/Lms.module.css"), ".noteEditor")).toContain("--sheet-measure: 32rem");
  });

  it("gives every sheet the same grab bar, in the surface's own ink", () => {
    expect(rule(read(recipe), ".handle")).toContain("var(--sheet-rule, var(--cw-platform-border))");
    expect(rule(read("src/components/builder/Builder.module.css"), ".asideHandle"))
      .toContain("--sheet-rule: var(--builder-rule)");
  });
});
