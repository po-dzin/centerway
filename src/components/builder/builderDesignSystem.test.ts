import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The builder's design-system invariants, as tests rather than as prose.
 *
 * Every case below is a defect that actually shipped and was found by reading
 * the file, not by anything failing. That is the argument for the file: the
 * builder is the surface with the most controls in the repo, `guard:buttons`
 * covers the button contract and nothing covered the rest, so motion, layering
 * and the icon scale each drifted until somebody looked.
 *
 * These are static assertions over the stylesheet and its call sites. They are
 * cheap, they run with the unit suite, and they fail on the next drift instead
 * of on the next audit.
 */

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const BUILDER_CSS = "src/components/builder/Builder.module.css";
const css = read(BUILDER_CSS);

/** Declarations, with comments stripped so prose is never read as code. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

const builderTsx = fs
  .readdirSync(path.join(root, "src/components/builder"))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => ({ name, source: read(`src/components/builder/${name}`) }));

describe("custom properties resolve", () => {
  /**
   * THE ONE THAT COST US A BROKEN POPOVER.
   *
   * `.pickerPanel` asked for `--ds-z-popover`, which is defined nowhere in the
   * repo — it was the only reference to the name. So the whole rule was the
   * fallback, the panel resolved to `z-index: 60` while every other builder
   * layer sits at 998–1002, and the block chooser opened underneath the save
   * bar. Nothing failed: a `var()` with a fallback is valid CSS, and a token
   * that does not exist looks exactly like one that does.
   *
   * A fallback is still allowed — the portalled surfaces need theirs, see
   * below — but it may not be the only thing standing up the value.
   */
  it("never reads a custom property that is defined nowhere", () => {
    const defined = new Set(
      [
        code,
        read("src/app/globals.css"),
        read("src/components/platform/PlatformButtons.module.css"),
      ].flatMap((source) => [...source.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1])),
    );

    const referenced = [...code.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]);
    const phantom = [...new Set(referenced)].filter((name) => !defined.has(name));

    expect(phantom).toEqual([]);
  });
});

describe("motion is named by its job", () => {
  const DURATION_TOKENS = [
    "--builder-motion-reveal",
    "--builder-motion-ink",
    "--builder-motion-tool",
    "--builder-motion-panel",
    "--builder-motion-page",
  ];

  it("declares every duration and curve as a token", () => {
    for (const token of [...DURATION_TOKENS, "--builder-ease-tool", "--builder-ease-page"]) {
      expect(code).toContain(`${token}:`);
    }
  });

  /**
   * Five durations and three curves were in this file with one token between
   * them, which is how the same reveal came to run 120ms on a block rail and
   * 140ms on the gap ring beside it. An axis with no token diverges — the
   * button contract says so in the design system, and motion proved it.
   */
  it("writes no literal duration or curve in a transition or animation", () => {
    const literals = [...code.matchAll(/(?:transition|animation):[^;]+;/g)]
      .map((m) => m[0])
      .filter((decl) => /\b\d+m?s\b/.test(decl) || /cubic-bezier/.test(decl))
      // A fallback inside var() is the documented exception, asserted below.
      .filter((decl) => !/var\(--builder-(motion|ease)-[a-z]+,/.test(decl));

    expect(literals).toEqual([]);
  });

  /**
   * `.menuList`, `.pickerPanel` and `.formatBar` render through a portal on
   * `document.body`, and the tokens are declared on `.shell`. Nothing there
   * inherits, so a bare `var(--builder-motion-tool)` computes to nothing and
   * the entrance animation silently stops existing. Each therefore carries a
   * fallback, and the fallback has to agree with the token it stands in for —
   * the same rule `guard:buttons` applies to the network's own fallbacks.
   */
  it("gives portalled surfaces a fallback that agrees with the token", () => {
    const tool = /--builder-motion-tool:\s*([^;]+);/.exec(code)?.[1].trim();
    const ease = /--builder-ease-tool:\s*([^;]+);/.exec(code)?.[1].trim();
    expect(tool).toBeTruthy();
    expect(ease).toBeTruthy();

    const portalled = [...code.matchAll(/animation:[^;]*var\(--builder-motion-tool,\s*([^)]+)\)/g)];
    expect(portalled.length).toBeGreaterThanOrEqual(3);
    for (const [, fallback] of portalled) expect(fallback.trim()).toBe(tool);
  });

  /**
   * It used to be three blocks in three parts of the file naming nine
   * selectors between them, which is why the format bar, the picker and every
   * reveal transition still moved for a reader who had asked them not to.
   */
  it("answers reduced motion in exactly one block, at the tokens", () => {
    const blocks = code.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? [];
    expect(blocks).toHaveLength(1);

    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    for (const token of DURATION_TOKENS) expect(block).toContain(`${token}: 0ms`);
    // The two cases zeroing a token cannot reach: a delayed keyframe under
    // `both` fill, and the portalled surfaces that inherit no token at all.
    for (const selector of [".blockList.docEnter", ".pickerPanel", ".formatBar", ".menuList"]) {
      expect(block).toContain(selector);
    }
  });
});

describe("layering", () => {
  /**
   * The builder paints six layers over the document. They are only correct
   * relative to each other, so they are all expressed against the one shared
   * token rather than as invented numbers — which is exactly what the picker
   * stopped doing when it reached for a token that did not exist.
   */
  it("expresses every overlay layer against --ds-z-sticky", () => {
    const overlays = [...code.matchAll(/z-index:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((value) => value !== "auto" && !/^[12]$/.test(value));

    expect(overlays.length).toBeGreaterThan(0);
    for (const value of overlays) expect(value).toContain("--ds-z-sticky");
  });

  it("keeps the block picker on the row menu's rung", () => {
    const picker = /\.pickerPanel\s*\{([\s\S]*?)\}/.exec(code)?.[1] ?? "";
    const menu = /\.menuList\s*\{([\s\S]*?)\}/.exec(code)?.[1] ?? "";
    const z = (rule: string) => /z-index:\s*([^;]+);/.exec(rule)?.[1].trim();

    expect(z(picker)).toBeTruthy();
    expect(z(picker)).toBe(z(menu));
  });
});

describe("one drawn line", () => {
  /**
   * The file header declares `--builder-rule` the single drawn-line token and
   * says why: the builder has no plates left to separate, so a divider here is
   * a line someone put on paper, not the seam between two materials. It had
   * split three ways anyway — `--cw-mat-stroke-inner` on the version rows,
   * `--cw-platform-border` (a visibly cooler mix) on the slug field, the
   * module badge and the lesson rail.
   */
  it("draws every rule with --builder-rule", () => {
    expect(code).not.toContain("--cw-mat-stroke-inner");
    expect(code).not.toContain("--cw-platform-border");
  });
});

describe("icons sit on the scale", () => {
  /**
   * Size follows the row a glyph sits in — 16 in a dense list, 18 in page and
   * tool chrome, 20 in a rail — and the builder had four glyphs that matched
   * nothing in their own row: `view-rows` and `plus` at 17, the palette lead
   * at 19, the selection title at 22.
   */
  it("renders every Icon at 16, 18 or 20", () => {
    const offScale: string[] = [];
    for (const { name, source } of builderTsx) {
      for (const [, size] of source.matchAll(/<Icon[^>]*?\bsize=\{(\d+)\}/g)) {
        if (!["16", "18", "20"].includes(size)) offScale.push(`${name}: ${size}`);
      }
    }
    expect(offScale).toEqual([]);
  });
});

describe("spacing steps exist", () => {
  /**
   * `var(--cw-space-3xs, 0.25rem)` read like a scale step and was not one: the
   * scale starts at `2xs`, which is itself 0.25rem — so ten call sites were
   * resolving through a fallback to precisely the value the real token already
   * carried. Invisible, and it teaches the next reader a step that does not
   * exist.
   */
  it("names no spacing step below the scale", () => {
    expect(code).not.toContain("--cw-space-3xs");
  });
});

describe("the course tabs sit below the header, not under it", () => {
  /**
   * Below 901px the platform header (`mode="workspace"`) is itself sticky at
   * `top: 0` — see PlatformResponsive.module.css's `.header.header[data-cw-
   * header-mode="workspace"]`. `.courseMobileNav` used to pin to the same
   * edge (`inset-block-start: 0`), so after any scroll two sticky layers sat
   * at the same coordinate and the header's higher z-index won: the three
   * mode tabs sat directly behind roughly 4rem of chrome instead of below it.
   * `--builder-topbar-height` is that header's own measured box, already
   * declared on `.shell` (this strip's ancestor) for exactly this number —
   * verified live to equal the header's real rendered height (65px at
   * 700px width) before this test was written.
   */
  it("pins the strip to --builder-topbar-height, not to the viewport edge", () => {
    const rule = /\.courseMobileNav\s*\{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    expect(rule).toContain("inset-block-start: var(--builder-topbar-height)");
  });
});
