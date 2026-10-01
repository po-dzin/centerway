import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), "utf8");

/**
 * An offer page lives on `www`; the course it opens lives on `my`. Every way
 * into the course from that page carries the ROUTE `/learn/<course>`, and a
 * route handed to the browser unresolved is an address on the wrong origin.
 *
 * 2026-10-01: the free-course button on `/programs/soul-daily-ritual` did
 * exactly that. The proxy now forwards such a link instead of 404ing, so this
 * is the second line — a button should name its destination, not spend a hop.
 */
describe("offer-page ways into a course resolve against the page's origin", () => {
  it("the free panel resolves `accessHref`", () => {
    const source = read("OfferCommerce.tsx");
    expect(source).toMatch(/<SurfaceLink[^>]*href=\{commerce\.accessHref\}/);
    expect(source).not.toMatch(/<Link[^>]*href=\{commerce\.accessHref\}/);
  });

  it("the hero and the sticky bar resolve the non-checkout buy href", () => {
    for (const file of ["OfferHeroState.tsx", "OfferStickyBar.tsx"]) {
      const source = read(file);
      expect(source, file).toContain("href={surfaceHref(buyHref)}");
      expect(source, file).not.toMatch(/<Link[^>]*href=\{buyHref\}/);
    }
  });
});
