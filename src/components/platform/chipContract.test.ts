import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
const block = (source: string, selector: string) => {
  const at = source.indexOf(`${selector} {`);
  if (at < 0) return "";
  return source.slice(at, source.indexOf("}", at));
};

/**
 * ONE CHIP, TWO GROUNDS.
 *
 * A short fact on its own ground was written five times and the five agreed on
 * nothing but the pill: four paddings, two type scales, three weights, four
 * grounds. The only difference that carried meaning was WHERE the chip sits —
 * on paper or on a photograph — so that is the only one left.
 */
describe("chip", () => {
  const consumers: Array<[string, string, "paper" | "media"]> = [
    ["src/components/platform/cabinet/Cabinet.module.css", ".chip", "paper"],
    ["src/components/platform/cabinet/Cabinet.module.css", ".chipDone", "paper"],
    ["src/components/platform/AuthorProfileShowcase.module.css", ".chip", "paper"],
    ["src/components/platform/PlatformBlocksTrust.module.css", ".guideBadge", "media"],
    ["src/components/platform/PlatformSurfaces.module.css", ".mediaBadge", "media"],
  ];

  it("is composed, never re-declared", () => {
    for (const [file, selector, ground] of consumers) {
      const rule = block(read(file), selector);
      expect(rule).toContain("composes: chip");
      if (ground === "media") expect(rule).toContain("onMedia");
      /* The five differences that were drift rather than meaning. A consumer
         restating any of them is the drift starting again. */
      for (const axis of ["padding", "font-size", "font-weight", "border-radius"]) {
        expect(rule).not.toContain(`${axis}:`);
      }
    }
  });

  it("keeps its rounded ends — a chip is a token, not a control", () => {
    expect(block(read("src/components/platform/Chip.module.css"), ".chip")).toContain(
      "border-radius: var(--cw-radius-pill)",
    );
  });

  it("says the ground once, and only the ground", () => {
    const media = block(read("src/components/platform/Chip.module.css"), ".onMedia");
    expect(media).toContain("var(--cw-mat-scrim-ink)");
    expect(media).toContain("var(--cw-mat-inverse-text)");
    // A second answer to "what is a chip's ground over a picture" is how the
    // 76% mix came to exist.
    expect(read("src/components/platform/PlatformSurfaces.module.css")).not.toContain(
      "color-mix(in srgb, var(--cw-mat-scrim-ink)",
    );
  });
});
