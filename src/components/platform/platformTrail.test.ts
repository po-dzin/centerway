import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The trail's tablet band, as a test rather than as prose.
 *
 * `.trail`'s "ONE LINE, ALWAYS" rule (see the file's own header comment)
 * answers the topbar's own row, where the trail is the only thing on it. In
 * the builder's page body at 561–900px it shares that row with tools that do
 * not shrink — preview, save status, blockers, contents — a room the flat
 * `nowrap` rule was never asked to hold up in: every crumb still floors at
 * the touch minimum (`chrome`'s own `min-width`), and a long course/module/
 * lesson title plus those tools could ask for more than the row had, with the
 * excess running under the tools or off the page.
 */

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../src/components/platform/PlatformTrail.module.css"),
  "utf8",
);
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations inside one `@media` block, keyed by its exact condition. */
function mediaBlock(source: string, condition: string): string {
  const marker = `@media ${condition}`;
  const start = source.indexOf(marker);
  if (start === -1) return "";
  let depth = 0;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      if (depth === 1) bodyStart = i + 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, i);
    }
  }
  return "";
}

describe("the trail wraps only in the tablet band", () => {
  it("keeps the base trail on one line", () => {
    const rule = /(?<!@media[^{]*)\.trail\s*\{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    expect(rule).toContain("flex-wrap: nowrap");
  });

  it("wraps the trail at 561–900px, where it shares the row with non-shrinking tools", () => {
    const block = mediaBlock(code, "(min-width: 561px) and (max-width: 900px)");
    expect(block).toContain(".trail");
    const rule = /\.trail\s*\{([\s\S]*?)\}/.exec(block)?.[1] ?? "";
    expect(rule).toContain("flex-wrap: wrap");
  });

  it("leaves the phone band (.back only) and the desktop band (moved into the header) alone", () => {
    // Below 561px only `.back` renders — see the file's "MOBILE FIRST" note —
    // so a stray override in that range would have no visible target and
    // exists only to be forgotten. Above 900px the builder hides `.pageTrail`
    // entirely (it moves into the shared header), so the tablet fix must not
    // leak past its own band either.
    const below = mediaBlock(code, "(max-width: 560px)");
    const above = mediaBlock(code, "(min-width: 901px)");
    expect(below).not.toContain("flex-wrap");
    expect(above).not.toContain("flex-wrap");
  });
});
