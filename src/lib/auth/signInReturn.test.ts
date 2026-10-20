import { afterEach, describe, expect, it, vi } from "vitest";

import { readStashedTarget, returnQuery, returnTargetFromHere, safeReturnTarget } from "./signInReturn";
import { PERSONAL_ORIGIN, PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

/**
 * A sign-in page that takes its destination from the query string is the exact
 * shape of an open redirect, so this is the test that matters most in the
 * module: everything it lets through is somewhere a freshly signed-in session
 * may be handed.
 */
describe("safeReturnTarget", () => {
  const here = PERSONAL_ORIGIN;

  it("keeps a same-origin destination relative", () => {
    // Relative, so the return stays a client navigation inside one app.
    expect(safeReturnTarget("/way21/day-1?from=mail", here)).toBe("/way21/day-1?from=mail");
  });

  it("keeps the query and the fragment", () => {
    expect(safeReturnTarget("/programs?tab=body#offer", here)).toBe("/programs?tab=body#offer");
  });

  it("allows the other CenterWay origin, absolutely", () => {
    // The common return IS a crossing: the door is on `my`, and most of the
    // pages that offer it are on `www`.
    expect(safeReturnTarget(`${PLATFORM_ORIGIN}/programs`, here)).toBe(`${PLATFORM_ORIGIN}/programs`);
    expect(safeReturnTarget(`${PERSONAL_ORIGIN}/profile`, PLATFORM_ORIGIN)).toBe(`${PERSONAL_ORIGIN}/profile`);
  });

  it("refuses another origin, however it is spelled", () => {
    expect(safeReturnTarget("https://evil.example/steal", here)).toBeNull();
    // Protocol-relative: a browser reads this as another host.
    expect(safeReturnTarget("//evil.example", here)).toBeNull();
    // One slash and a backslash — a URL parser reads the backslash as a slash.
    expect(safeReturnTarget("/\\evil.example", here)).toBeNull();
    // A lookalike subdomain is not one of ours.
    expect(safeReturnTarget("https://my.centerway.net.ua.evil.example/", here)).toBeNull();
  });

  it("refuses a non-http scheme", () => {
    expect(safeReturnTarget("javascript:alert(1)", here)).toBeNull();
    expect(safeReturnTarget("data:text/html,<script>", here)).toBeNull();
  });

  it("has nothing to say about nothing", () => {
    expect(safeReturnTarget(null, here)).toBeNull();
    expect(safeReturnTarget("", here)).toBeNull();
  });
});

describe("returnQuery", () => {
  it("encodes the destination so a nested query survives", () => {
    expect(returnQuery("/programs?tab=body")).toBe("?next=%2Fprograms%3Ftab%3Dbody");
  });

  it("is empty when there is nothing to carry", () => {
    expect(returnQuery(null)).toBe("");
  });
});

describe("returnTargetFromHere", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the exact deep link, query and fragment for a sign-in wall", () => {
    vi.stubGlobal("window", {
      location: {
        origin: PERSONAL_ORIGIN,
        pathname: "/learn/way21/breathing",
        search: "?from=shared",
        hash: "#practice-2",
      },
    });

    expect(returnTargetFromHere()).toBe(`${PERSONAL_ORIGIN}/learn/way21/breathing?from=shared#practice-2`);
  });

  it("keeps the personal promo offer and format when returning from sign-in", () => {
    // A tokenized `/go/way21` resolves to this storefront address before the
    // sign-in action. Both parameters must survive the auth round trip.
    vi.stubGlobal("window", {
      location: {
        origin: PLATFORM_ORIGIN,
        pathname: "/programs/way21",
        search: "?offer_token=personal-token&offer_code=course%3Away21",
        hash: "",
      },
    });

    expect(returnTargetFromHere()).toBe(
      `${PLATFORM_ORIGIN}/programs/way21?offer_token=personal-token&offer_code=course%3Away21`,
    );
  });

  it("keeps an already-carried destination when sign-in is one step away", () => {
    const destination = `${PLATFORM_ORIGIN}/learn/way21/breathing?from=shared#practice-2`;
    vi.stubGlobal("window", {
      location: {
        origin: PERSONAL_ORIGIN,
        pathname: "/profile",
        search: `?next=${encodeURIComponent(destination)}`,
        hash: "",
      },
    });

    expect(returnTargetFromHere()).toBe(destination);
  });
});

describe("readStashedTarget", () => {
  const here = PERSONAL_ORIGIN;
  const now = 1_000_000_000;
  const record = (target: unknown, at: unknown) => JSON.stringify({ target, at });

  it("returns a fresh address kept before the Google hop", () => {
    expect(readStashedTarget(record(`${PLATFORM_ORIGIN}/programs`, now - 60_000), now, here)).toBe(
      `${PLATFORM_ORIGIN}/programs`,
    );
  });

  it("forgets an address older than a quarter of an hour", () => {
    expect(readStashedTarget(record("/learn", now - 16 * 60_000), now, here)).toBeNull();
  });

  it("refuses a foreign origin, a broken record, and nothing at all", () => {
    expect(readStashedTarget(record("https://evil.example/", now), now, here)).toBeNull();
    expect(readStashedTarget("{not json", now, here)).toBeNull();
    expect(readStashedTarget(record(42, now), now, here)).toBeNull();
    expect(readStashedTarget(null, now, here)).toBeNull();
  });
});
