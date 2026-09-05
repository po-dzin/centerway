import { describe, expect, it } from "vitest";
import { DOSHA_PRIMARY_EXIT, DOSHA_SECONDARY_EXIT, doshaExitHref } from "./doshaRouting";

describe("doshaExitHref", () => {
  it("carries the result and its confidence to the landing", () => {
    const href = doshaExitHref(DOSHA_PRIMARY_EXIT, { resultType: "vata_pitta", confidence: "low" });
    const query = new URLSearchParams(href.split("?")[1]);
    expect(query.get("dosha")).toBe("vata_pitta");
    expect(query.get("dosha_confidence")).toBe("low");
    expect(query.get("utm_medium")).toBe("dosha_test");
    // The lead form on the landing forwards utm_content untouched.
    expect(query.get("utm_content")).toBe("dosha_vata_pitta");
  });

  it("keeps whatever query the exit already had", () => {
    const exit = { ...DOSHA_SECONDARY_EXIT, href: "https://example.com/way21?product=way21" };
    const href = doshaExitHref(exit, { resultType: "kapha" });
    const query = new URLSearchParams(href.split("?")[1]);
    expect(query.get("product")).toBe("way21");
    expect(query.get("dosha")).toBe("kapha");
    expect(href.startsWith("https://example.com/way21?")).toBe(true);
  });

  it("says nothing about a dosha to an exit that has not claimed the method", () => {
    // The platform is multi-author: a consultation in another method must not
    // be handed a vocabulary its expert never agreed to.
    const neutral = { href: "https://example.com/consultants" };
    const query = new URLSearchParams(
      doshaExitHref(neutral, { resultType: "vata", confidence: "high" }).split("?")[1]
    );
    expect(query.get("dosha")).toBeNull();
    expect(query.get("dosha_confidence")).toBeNull();
    expect(query.get("utm_content")).toBeNull();
    expect(query.get("utm_medium")).toBe("dosha_test");
  });

  it("still leaves a usable link when there is no result yet", () => {
    const href = doshaExitHref(DOSHA_PRIMARY_EXIT, { resultType: null });
    expect(new URLSearchParams(href.split("?")[1]).get("dosha")).toBeNull();
  });
});
