import { describe, expect, it } from "vitest";

import { isThemeChoice, THEME_BOOT_SCRIPT, THEME_STORAGE_KEY, themeCookieAttributes } from "./theme";

// `themeCookieAttributes` mirrors `sessionCookieOptions` deliberately — see
// `auth/sessionCookie.test.ts` for the domain-scoping rule this reuses.
describe("themeCookieAttributes", () => {
  it("scopes to the parent domain on the real site, so www/my/build share it", () => {
    expect(themeCookieAttributes("www.centerway.net.ua", "https:")).toContain("domain=.centerway.net.ua");
    expect(themeCookieAttributes("my.centerway.net.ua", "https:")).toContain("domain=.centerway.net.ua");
    expect(themeCookieAttributes("way21.centerway.net.ua", "https:")).toContain("domain=.centerway.net.ua");
  });

  it("stays host-only off the real site", () => {
    expect(themeCookieAttributes("cw-git-branch.vercel.app", "https:")).not.toContain("domain=");
    expect(themeCookieAttributes("localhost", "http:")).not.toContain("domain=");
  });

  it("drops Secure on plain http, so localhost isn't silently discarded", () => {
    expect(themeCookieAttributes("localhost", "http:")).not.toContain("secure");
    expect(themeCookieAttributes("localhost", "https:")).toContain("secure");
  });

  it("always carries path, a year of max-age, and Lax", () => {
    const attrs = themeCookieAttributes("www.centerway.net.ua", "https:");
    expect(attrs).toContain("path=/");
    expect(attrs).toContain("max-age=31536000");
    expect(attrs).toContain("samesite=lax");
  });
});

describe("isThemeChoice", () => {
  it("accepts exactly the three choices", () => {
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("system")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isThemeChoice("auto")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
    expect(isThemeChoice(1)).toBe(false);
  });
});

// The boot script is inlined into HTML, not imported, so it cannot be called
// directly from a Node-environment test — this repo does not run jsdom (see
// vitest.config.ts). What is checked here is the one thing a silent drift
// would break without any type system catching it: the literal cookie name
// and domain baked into the string match the constants the runtime functions
// use, and both write paths (fresh choice, legacy `localStorage` carry-over)
// are present in the source.
describe("THEME_BOOT_SCRIPT", () => {
  it("reads and migrates the same cookie key the runtime writes", () => {
    expect(THEME_BOOT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_BOOT_SCRIPT).toContain(".centerway.net.ua");
  });

  it("falls back to localStorage only when the cookie has nothing", () => {
    expect(THEME_BOOT_SCRIPT).toContain("localStorage.getItem(k)");
    expect(THEME_BOOT_SCRIPT).toContain("document.cookie=k+");
  });
});
