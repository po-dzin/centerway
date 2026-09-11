/**
 * Pagination for every admin list, from a query string an operator can edit,
 * mistype or receive in a stale link.
 *
 * All three failures below were reproduced against the real database before
 * this was hardened; the values reach `.range(offset, offset + limit - 1)`
 * directly.
 */

import { describe, expect, it } from "vitest";
import { parseLimitOffset } from "./adminRoute";

const bounds = { defaultLimit: 50, maxLimit: 100 };
const parse = (query: string) => parseLimitOffset(new URLSearchParams(query), bounds);

describe("parseLimitOffset", () => {
  it("uses the defaults when nothing is asked for", () => {
    expect(parse("")).toEqual({ limit: 50, offset: 0 });
  });

  it("falls back rather than returning an empty list for a non-numeric limit", () => {
    // Live, before the fix: NaN reached `.range()` and the query returned zero
    // rows with no error — an operator reads that as "the queue is empty".
    expect(parse("limit=abc")).toEqual({ limit: 50, offset: 0 });
    expect(parse("limit=")).toEqual({ limit: 50, offset: 0 });
    // `Infinity` is not a page size either — it is unusable input like the
    // rest, so it says nothing and gets the default rather than the cap.
    expect(parse("limit=Infinity")).toEqual({ limit: 50, offset: 0 });
    expect(parse("limit=NaN")).toEqual({ limit: 50, offset: 0 });
  });

  it("falls back rather than returning an empty list for a non-numeric offset", () => {
    expect(parse("offset=abc")).toEqual({ limit: 50, offset: 0 });
  });

  it("clamps a negative limit instead of 500ing the request", () => {
    // Live, before the fix: `?limit=-5` → "Requested range not satisfiable".
    expect(parse("limit=-5").limit).toBe(1);
    expect(parse("limit=0").limit).toBe(1);
  });

  it("clamps a negative offset, which has no meaning a caller intended", () => {
    expect(parse("offset=-10").offset).toBe(0);
  });

  it("caps the page size however large the request", () => {
    expect(parse("limit=1000000").limit).toBe(100);
    expect(parse("limit=1e9").limit).toBe(100);
  });

  it("floors a fractional page size rather than sending it to the database", () => {
    expect(parse("limit=10.7").limit).toBe(10);
    expect(parse("offset=5.9").offset).toBe(5);
  });

  it("ignores repeated parameters the way URLSearchParams does, without throwing", () => {
    expect(parse("limit=10&limit=99").limit).toBe(10);
  });

  it("survives a hostile query string", () => {
    expect(parse("limit=%27--&offset=<script>")).toEqual({ limit: 50, offset: 0 });
  });
});
