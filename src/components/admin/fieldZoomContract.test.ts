import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * SIXTEEN PIXELS IS THE ZOOM THRESHOLD, NOT A TYPE PREFERENCE.
 *
 * Safari on iOS magnifies the page when a field under 16px takes focus, and it
 * does not magnify back. In the control panel that turned a tap on the order
 * search into a zoomed layout with the table off the right edge and the
 * keyboard over the way back.
 *
 * The fix is a floor in the recipe, never `maximum-scale=1` on the viewport:
 * that would disable pinch zoom for every reader, permanently, to spare one
 * stylesheet line.
 */
describe("no field on any surface can be small enough to zoom iOS", () => {
  /* Walked rather than globbed: `fs.globSync` is not in this toolchain's type
     surface, and a guard that only runs is not a guard that typechecks. */
  const cssFiles = (function walk(dir: string): string[] {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(rel);
      return entry.name.endsWith(".css") ? [rel] : [];
    });
  })("src");

  it("finds the surfaces' field recipes at all", () => {
    /* A guard that silently matches nothing passes forever. */
    expect(cssFiles.length).toBeGreaterThan(10);
  });

  it("declares no font-size below 1rem on a text-entry control", () => {
    const offenders: string[] = [];

    for (const rel of cssFiles) {
      const css = strip(read(rel));
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1].trim().replace(/\s+/g, " ");
        if (!/\b(input|textarea|select)\b/.test(selector)) continue;
        const size = /font-size:\s*([^;]+);/.exec(match[2]);
        if (!size) continue;

        const value = size[1].trim();
        /* Token- and max()-valued sizes are read through their own tests; what
           this catches is a literal typed under the threshold. */
        const literal = /^(\d*\.?\d+)(rem|px|em)$/.exec(value);
        if (!literal) continue;
        const px = literal[2] === "px" ? Number(literal[1]) : Number(literal[1]) * 16;
        if (px < 16) offenders.push(`${rel}: ${selector.slice(0, 60)} → ${value}`);
      }
    }

    expect(offenders, `these fields will zoom iOS on focus:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("puts the panel's floor on the element, where a Tailwind size cannot undercut it", () => {
    /* Every one of the panel's field call sites types a Tailwind size, and all
       of them are below the line — 32 × text-sm, 2 × text-xs. A bare
       `.cw-input` ties with `.text-sm` on specificity and loses to whichever
       lands later in the layer order; qualifying by element wins outright. */
    const globals = strip(read("src/app/globals.css"));
    expect(globals).toMatch(/input\.cw-input,\s*select\.cw-input,\s*textarea\.cw-input\s*\{[^}]*font-size:\s*max\(/);
  });

  it("never buys the fix by disabling pinch zoom", () => {
    const layout = read("src/app/(platform)/layout.tsx");
    expect(layout).not.toContain("maximumScale");
    expect(layout).not.toContain("userScalable");
    expect(layout).toContain("initialScale: 1");
  });
});
