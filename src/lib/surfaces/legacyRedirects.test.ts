import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("addresses the old site-builder left behind", () => {
  it("sends each to the page that answers the same question, permanently, on the platform host only", async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    const sourceOf = (destination: string) => rules.find((rule) => rule.destination === destination)?.source;

    expect(rules.map((rule) => rule.destination).sort()).toEqual(
      ["/legal/privacy", "/programs/irem", "/programs/natural-body"].sort(),
    );
    for (const rule of rules) {
      expect(rule.permanent).toBe(true);
      expect(rule.has).toEqual([{ type: "host", value: "www.centerway.net.ua" }]);
    }
    expect(sourceOf("/programs/natural-body")).toBe("/idealne-tilo-ayorveda");
    expect(sourceOf("/programs/irem")).toBe("/vidnovlyucha-gimnastuka");
    expect(decodeURIComponent(sourceOf("/legal/privacy") ?? "")).toBe("/політика-конфіденційності");
  });

  it("does not redirect a page that stays 404 on purpose", async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    const sources = rules.map((rule) => rule.source);
    expect(sources).not.toContain("/about-me");
    expect(sources.some((source) => source.startsWith("/_api"))).toBe(false);
  });
});
