import { describe, expect, it } from "vitest";

import { BRAND } from "@/lib/brand/identity";

import { organizationLd, websiteLd } from "./jsonLd";

describe("brand structured data", () => {
  it("names the brand in the spellings people search for", () => {
    for (const node of [organizationLd(), websiteLd()]) {
      expect(node.name).toBe(BRAND.name);
      expect(node.alternateName).toEqual(expect.arrayContaining(["Центрвей", "Center Way"]));
    }
  });

  it("keeps the category out of alternateName", () => {
    const org = organizationLd();
    expect(org.alternateName).not.toContain(BRAND.category);
    expect(org.disambiguatingDescription).toBe(BRAND.category);
  });

  it("states the country, so a same-name business abroad is not the match", () => {
    expect(organizationLd().address).toEqual({ "@type": "PostalAddress", addressCountry: "UA" });
  });
});
