import { describe, expect, it } from "vitest";
import { cleanTelegramUsername } from "./telegramContact";

describe("cleanTelegramUsername", () => {
  it("drops the @ and the spaces", () => {
    expect(cleanTelegramUsername(" @anna_k ")).toBe("anna_k");
    expect(cleanTelegramUsername("anna_k")).toBe("anna_k");
  });

  it("treats empty and non-strings as no username", () => {
    expect(cleanTelegramUsername("")).toBeNull();
    expect(cleanTelegramUsername("@")).toBeNull();
    expect(cleanTelegramUsername(null)).toBeNull();
    expect(cleanTelegramUsername(996108610)).toBeNull();
  });
});
