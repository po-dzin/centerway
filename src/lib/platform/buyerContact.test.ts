import { describe, expect, it } from "vitest";

import { contactHref, normalizeBuyerName, normalizeContactValue, readBuyerDetails } from "./buyerContact";

describe("the buyer's name", () => {
  it("is trimmed and its inner spaces collapsed", () => {
    expect(normalizeBuyerName("  Олена   Коваль ")).toBe("Олена Коваль");
  });

  it("must hold a letter and fit the column", () => {
    expect(normalizeBuyerName("   ")).toBeNull();
    expect(normalizeBuyerName("123")).toBeNull();
    expect(normalizeBuyerName("я".repeat(81))).toBeNull();
  });
});

describe("a Telegram contact", () => {
  it("takes a username however it is pasted", () => {
    expect(normalizeContactValue("telegram", "anna_k")).toBe("@anna_k");
    expect(normalizeContactValue("telegram", "@anna_k")).toBe("@anna_k");
    expect(normalizeContactValue("telegram", "https://t.me/anna_k")).toBe("@anna_k");
  });

  it("takes the phone the account is on, a local Ukrainian number included", () => {
    expect(normalizeContactValue("telegram", "067 123 45 67")).toBe("+380671234567");
    expect(normalizeContactValue("telegram", "+380 (67) 123-45-67")).toBe("+380671234567");
  });

  it("refuses what is neither", () => {
    expect(normalizeContactValue("telegram", "ann")).toBeNull();
    expect(normalizeContactValue("telegram", "anna k")).toBeNull();
    expect(normalizeContactValue("telegram", "12345")).toBeNull();
  });
});

describe("a WhatsApp contact", () => {
  it("is a phone and nothing else", () => {
    expect(normalizeContactValue("whatsapp", "+48 512 345 678")).toBe("+48512345678");
    expect(normalizeContactValue("whatsapp", "@anna_k")).toBeNull();
  });
});

describe("the whole set", () => {
  it("is null when any part is missing", () => {
    expect(readBuyerDetails({ name: "Анна", channel: "viber", contact: "+380671234567" })).toBeNull();
    expect(readBuyerDetails({ name: "", channel: "telegram", contact: "@anna_k" })).toBeNull();
    expect(readBuyerDetails({ name: "Анна", channel: "telegram", contact: "" })).toBeNull();
  });

  it("comes back normalised", () => {
    expect(readBuyerDetails({ name: " Анна ", channel: "whatsapp", contact: "067 123 45 67" })).toEqual({
      name: "Анна",
      contact: { channel: "whatsapp", value: "+380671234567" },
    });
  });
});

describe("the admin's link to the buyer", () => {
  it("opens the right app", () => {
    expect(contactHref({ channel: "telegram", value: "@anna_k" })).toBe("https://t.me/anna_k");
    expect(contactHref({ channel: "telegram", value: "+380671234567" })).toBe("https://t.me/+380671234567");
    expect(contactHref({ channel: "whatsapp", value: "+380671234567" })).toBe("https://wa.me/380671234567");
  });
});
