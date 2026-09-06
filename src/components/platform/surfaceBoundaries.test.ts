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
    /* THE RECIPE MOVED UP A FLOOR (2026-09-06). `.mediaBadge` was one of five
       chips in the product with five paddings, three weights and four grounds;
       it is now the platform chip wearing its media ground, so the shape and
       the borderlessness this test has always guarded live in `Chip.module.css`
       and the media capsule's three consumers keep composing exactly as they
       did. */
    const chip = read("src/components/platform/Chip.module.css");
    expect(chip).toContain("border-radius: var(--cw-radius-pill)");
    expect(chip).toContain("border: 0");
    expect(block(read("src/components/platform/PlatformSurfaces.module.css"), ".mediaBadge"))
      .toContain("composes: chip onMedia");
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

    // The catalogue's price interval is the only new bounded control on the
    // public filter, so it answers the same quiet-contour rule as the search
    // field beside it — and never reaches for the checkbox's strong stroke.
    const catalogue = read("src/components/platform/PlatformCatalogFilter.module.css");
    expect(block(catalogue, ".bandField")).toContain("--cw-mat-stroke-quiet");
    expect(block(catalogue, ".bandField")).not.toContain("--cw-mat-stroke-control");
    expect(block(catalogue, ".bandField:focus-within")).toContain("--ds-focus-ring-color");
  });

  /* THE AUTHOR AIMS AT THE FRAME THAT SHIPS.
     The band was once a fixed HEIGHT against a fluid column, so it drew 5.18:1
     on a desktop, 2.73:1 on a phone and 2.19:1 at 320 — while the cabinet's
     crop editor previewed 6:1. Four pictures, none of them the one the author
     framed. Both frames read one token now, and this is what stops a future
     hand-typed number from quietly reopening the gap: a comment asking two
     files to agree is not a contract.

     Every rule for each frame is checked, not just the first — both selectors
     are declared twice (a base rule and a responsive one), and the ratio only
     has to slip into one of them for the two frames to part again. */
  it("crops the author banner to one ratio in the editor and on the page", () => {
    const rules = (source: string, selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [...source.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "g"))].map((m) => m[1]);
    };

    expect(read("data/design-tokens/cw.tokens.json")).toContain('"--ds-author-banner-ratio": "5 / 1"');

    const page = rules(read("src/components/platform/AuthorProfileShowcase.module.css"), ".bannerFrame");
    const editor = rules(read("src/components/platform/cabinet/Cabinet.module.css"), ".photoCropBanner");
    expect(page.length).toBeGreaterThan(0);
    expect(editor.length).toBeGreaterThan(0);

    for (const [side, frames] of [["page", page], ["editor", editor]] as const) {
      const shaped = frames.filter((rule) => rule.includes("aspect-ratio"));
      // Exactly one rule per side states the shape, and it states it as the token.
      expect(shaped, `${side}: one rule should set the ratio`).toHaveLength(1);
      expect(shaped[0]).toContain("aspect-ratio: var(--ds-author-banner-ratio)");

      for (const rule of frames) {
        // No frame may re-type a ratio of its own, in any notation …
        expect(rule, `${side}: literal ratio`).not.toMatch(/aspect-ratio:\s*[\d.]/);
        // … nor go back to sizing the band by height, which is what made the
        // shape depend on the viewport in the first place. `min-height` and
        // `line-height` are other properties and are left alone.
        expect(rule, `${side}: fixed height`).not.toMatch(/[^-\w]height:/);
      }
    }
  });
});
