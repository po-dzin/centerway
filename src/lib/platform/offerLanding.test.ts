import { describe, expect, it } from "vitest";

import { offerLandingUrl } from "./offerLanding";

describe("offerLandingUrl", () => {
  it("gives each funnel-backed program its own landing", () => {
    expect(offerLandingUrl("way21")).toBe("https://way21.centerway.net.ua/");
    expect(offerLandingUrl("reset-day")).toBe("https://resetday.centerway.net.ua/");
    expect(offerLandingUrl("reboot")).toBe("https://reboot.centerway.net.ua/");
    expect(offerLandingUrl("irem")).toBe("https://irem.centerway.net.ua/");
  });

  it("refuses a legacy alias, which would sell a different address", () => {
    // `detox` resolves to the way21 product, and way21 is sold at /programs/way21.
    expect(offerLandingUrl("detox")).toBeNull();
    // `short` resolves to reboot, sold at /programs/reboot.
    expect(offerLandingUrl("short")).toBeNull();
  });

  it("refuses a product whose host is not this offer's landing", () => {
    // A test router and a product page, not the landing of a program.
    expect(offerLandingUrl("dosha")).toBeNull();
    expect(offerLandingUrl("herbs")).toBeNull();
    expect(offerLandingUrl("consult")).toBeNull();
  });

  it("gives a builder course with no funnel nothing at all", () => {
    expect(offerLandingUrl("natural-body")).toBeNull();
    expect(offerLandingUrl("")).toBeNull();
  });
});
