import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE_DOMAIN,
  isPlatformDomain,
  legacySessionStorageKey,
  sessionCookieOptions,
} from "./sessionCookie";

describe("isPlatformDomain", () => {
  it("accepts the apex and its subdomains", () => {
    expect(isPlatformDomain("centerway.net.ua")).toBe(true);
    expect(isPlatformDomain("www.centerway.net.ua")).toBe(true);
    expect(isPlatformDomain("way21.centerway.net.ua")).toBe(true);
    expect(isPlatformDomain("my.centerway.net.ua")).toBe(true);
    expect(isPlatformDomain("way21.centerway.net.ua")).toBe(true);
  });

  it("refuses a lookalike that merely ends with the name", () => {
    // A plain endsWith test would hand the session scope to whoever registers
    // a domain ending this way.
    expect(isPlatformDomain("centerway.net.ua.evil.com")).toBe(false);
    expect(isPlatformDomain("notcenterway.net.ua")).toBe(false);
  });

  it("refuses dev and preview hosts", () => {
    expect(isPlatformDomain("localhost")).toBe(false);
    expect(isPlatformDomain("127.0.0.1")).toBe(false);
    expect(isPlatformDomain("cw-git-branch.vercel.app")).toBe(false);
    expect(isPlatformDomain(null)).toBe(false);
  });

  it("ignores the port", () => {
    expect(isPlatformDomain("www.centerway.net.ua:443")).toBe(true);
    expect(isPlatformDomain("localhost:8000")).toBe(false);
  });
});

describe("sessionCookieOptions", () => {
  it("scopes to the parent domain on the real site, so subdomains share it", () => {
    const options = sessionCookieOptions("www.centerway.net.ua");
    expect(options.domain).toBe(SESSION_COOKIE_DOMAIN);
    expect(options.secure).toBe(true);
    expect(options.path).toBe("/");
  });

  it("stays host-only off the real site", () => {
    // `vercel.app` is a public suffix — a cookie scoped to it is refused — and
    // two previews are two different builds anyway.
    expect(sessionCookieOptions("cw-git-branch.vercel.app").domain).toBeUndefined();
    expect(sessionCookieOptions("localhost", "http:").domain).toBeUndefined();
  });

  it("drops Secure on plain http", () => {
    // A Secure cookie over http is silently discarded, which on localhost looks
    // exactly like "sign-in does nothing".
    expect(sessionCookieOptions("localhost", "http:").secure).toBe(false);
    expect(sessionCookieOptions("localhost", "https:").secure).toBe(true);
  });

  it("uses lax, because the OAuth provider returns as a cross-site navigation", () => {
    expect(sessionCookieOptions("www.centerway.net.ua").sameSite).toBe("lax");
  });
});

describe("legacySessionStorageKey", () => {
  it("derives the key supabase-js used, so a signed-in account carries over", () => {
    expect(legacySessionStorageKey("https://ibqexzkvtdmvuxenmvpy.supabase.co")).toBe(
      "sb-ibqexzkvtdmvuxenmvpy-auth-token",
    );
  });

  it("answers null rather than a wrong key when the URL is unusable", () => {
    expect(legacySessionStorageKey("")).toBeNull();
    expect(legacySessionStorageKey("not a url")).toBeNull();
  });
});
