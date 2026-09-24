import { describe, expect, it } from "vitest";

import { returnQuery, safeReturnTarget } from "./signInReturn";
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
