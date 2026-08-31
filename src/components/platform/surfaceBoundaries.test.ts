import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
const block = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(source)?.[1] ?? "";
};

describe("shared surface boundaries", () => {
  it("keeps the media-menu paint at the optical hover size, not the touch target", () => {
    const css = read("src/components/builder/Builder.module.css");
    const paint = block(css, ".courseCard > .menuRoot > .menuTrigger::before");
    expect(paint).toContain("inline-size: var(--cw-ink-hover-paint-size)");
    expect(paint).toContain("block-size: var(--cw-ink-hover-paint-size)");
    expect(paint).toContain("translate(-50%, -50%)");
    expect(paint).not.toContain("inset: 0;");
    const tokens = read("data/design-tokens/cw.tokens.json");
    expect(tokens).toContain("calc(var(--cw-ink-ring-size) * var(--cw-ink-hover-scale) * var(--cw-ink-ring-optical-ratio))");
  });

  it("uses one borderless media capsule in library and workshop", () => {
    const recipe = read("src/components/platform/PlatformSurfaces.module.css");
    expect(recipe).toContain("border-radius: var(--cw-radius-pill)");
    expect(recipe).toContain("border: 0");
    for (const [file, selector] of [
      ["src/components/platform/cabinet/Cabinet.module.css", ".draftBadgeChip"],
      ["src/components/builder/Builder.module.css", ".coverPill"],
      ["src/components/builder/Builder.module.css", ".coverPillPublished"],
    ]) {
      expect(block(read(file), selector)).toContain("composes: mediaBadge");
    }
    expect(read("src/components/platform/cabinet/CourseCard.tsx")).not.toContain('className={styles.draftBadgeChip} {...glassMedia}');
  });

  it("removes both decorative edges from loading and library objects, not structural panels", () => {
    const globals = read("src/app/globals.css");
    expect(block(globals, '[data-cw-material][data-cw-edge="none"]')).toContain("border-color: transparent");
    expect(block(globals, '[data-cw-material][data-cw-edge="none"]::before')).toContain("box-shadow: none");
    for (const file of ["src/components/platform/PlatformLoadingState.tsx", "src/components/platform/cabinet/CourseCard.tsx"]) {
      expect(read(file)).toContain('data-cw-edge="none"');
    }
    expect(read("src/components/platform/cabinet/AuthorProfileFold.tsx")).not.toContain('data-cw-edge="none"');
  });

  it("distinguishes quiet command boundaries from the strong checkbox state", () => {
    const buttons = read("src/components/platform/PlatformButtons.module.css");
    const filter = read("src/components/platform/cabinet/ShelfFilter.module.css");
    expect(block(buttons, ".secondary")).toContain("--cw-mat-stroke-quiet");
    expect(block(filter, ".find")).toContain("--cw-mat-stroke-quiet");
    expect(block(filter, ".filterCheckbox")).toContain("--cw-mat-stroke-control");
    expect(block(filter, ".filterOptions")).toContain("border-image: var(--cw-rule-fade-x)");
    expect(filter).toContain("flex: 0 0 1.15rem");
    expect(filter).toContain(".filterToggle:hover:not(:disabled)");
    expect(filter).toContain(".filterToggle:active:not(:disabled)");
    expect(block(filter, '.filterToggle[aria-expanded="true"]')).toContain("transform: none");
  });
});
