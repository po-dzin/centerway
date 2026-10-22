/**
 * A media override declared ABOVE the base rule it overrides never applies.
 *
 * Same selector, same specificity: the later declaration wins, so a
 * `@media (min-width: 1280px) { .headControls { width: auto } }` written before
 * `.headControls { width: 100% }` is dead code. That is how the analytics head
 * plate came to squeeze its title into two lines beside a date picker with half
 * the card empty, and nothing reported it — the stylesheet was valid. This reads
 * every stylesheet and names the pairs.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const files = execSync("git ls-files 'src/**/*.css'", { encoding: "utf8" })
  .split("\n")
  .filter((file) => file && !file.includes("landing-static"));

describe("stylesheet source order", () => {
  it("never declares a media override before the base rule it overrides", () => {
    const found: string[] = [];
    for (const file of files) {
      let root: postcss.Root;
      try {
        root = postcss.parse(readFileSync(file, "utf8"), { from: file });
      } catch {
        continue;
      }
      const base = new Map<string, { index: number; line: number }>();
      const overrides: Array<{ selector: string; prop: string; index: number; line: number }> = [];
      let index = 0;
      root.each((node) => {
        index += 1;
        if (node.type === "rule") {
          node.walkDecls((decl) => {
            base.set(`${node.selector}|${decl.prop}`, { index, line: decl.source?.start?.line ?? 0 });
          });
        }
        if (node.type === "atrule" && node.name === "media") {
          node.walkRules((rule) => {
            rule.walkDecls((decl) => {
              overrides.push({
                selector: rule.selector,
                prop: decl.prop,
                index,
                line: decl.source?.start?.line ?? 0,
              });
            });
          });
        }
      });
      for (const override of overrides) {
        const later = base.get(`${override.selector}|${override.prop}`);
        if (later && later.index > override.index) {
          found.push(
            `${file}:${override.line} ${override.selector} { ${override.prop} } is overridden by line ${later.line}`,
          );
        }
      }
    }
    expect(found).toEqual([]);
  });
});
