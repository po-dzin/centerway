import { describe, expect, it } from "vitest";

import {
  contactHref,
  normalizeBuyerName,
  normalizeContactPhone,
  readBuyerDetails,
  readPrimaryContact,
} from "./buyerContact";

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

describe("«Телефон або Telegram»", () => {
  it("reads a Telegram username however it is pasted", () => {
    expect(readPrimaryContact("anna_k")).toEqual({ channel: "telegram", value: "@anna_k" });
    expect(readPrimaryContact("@anna_k")).toEqual({ channel: "telegram", value: "@anna_k" });
    expect(readPrimaryContact("https://t.me/anna_k")).toEqual({ channel: "telegram", value: "@anna_k" });
  });

  it("reads a phone, a local Ukrainian number included", () => {
    expect(readPrimaryContact("067 123 45 67")).toEqual({ channel: "phone", value: "+380671234567" });
    expect(readPrimaryContact("+380 (67) 123-45-67")).toEqual({ channel: "phone", value: "+380671234567" });
  });

  it("refuses what is neither", () => {
    expect(readPrimaryContact("ann")).toBeNull();
    expect(readPrimaryContact("anna k")).toBeNull();
    expect(readPrimaryContact("12345")).toBeNull();
  });
});

describe("a WhatsApp number", () => {
  it("is a phone and nothing else", () => {
    expect(normalizeContactPhone("+48 512 345 678")).toBe("+48512345678");
    expect(normalizeContactPhone("@anna_k")).toBeNull();
  });
});

describe("the whole set", () => {
  it("is null when the name or the required contact is missing", () => {
    expect(readBuyerDetails({ name: "", contact: "@anna_k" })).toBeNull();
    expect(readBuyerDetails({ name: "Анна", contact: "" })).toBeNull();
  });

  it("leaves WhatsApp optional, but refuses one that is not a number", () => {
    expect(readBuyerDetails({ name: "Анна", contact: "@anna_k", whatsapp: "" })?.whatsapp).toBeNull();
    expect(readBuyerDetails({ name: "Анна", contact: "@anna_k", whatsapp: "anna" })).toBeNull();
  });

  it("comes back normalised", () => {
    expect(readBuyerDetails({ name: " Анна ", contact: "067 123 45 67", whatsapp: "+48 512 345 678" })).toEqual({
      name: "Анна",
      contact: { channel: "phone", value: "+380671234567" },
      whatsapp: "+48512345678",
    });
  });
});

describe("the admin's link to the buyer", () => {
  it("opens the right app", () => {
    expect(contactHref({ channel: "telegram", value: "@anna_k" })).toBe("https://t.me/anna_k");
    expect(contactHref({ channel: "phone", value: "+380671234567" })).toBe("tel:+380671234567");
    expect(contactHref({ channel: "whatsapp", value: "+380671234567" })).toBe("https://wa.me/380671234567");
  });
});
