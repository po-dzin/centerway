/**
 * The admin search boxes, as a grammar problem.
 *
 * `.or()` takes its filter as a string, so an interpolated search term is the
 * typist editing the query. Both failures below were reproduced against the
 * real `leads` table before this helper existed.
 */

import { describe, expect, it } from "vitest";
import { orIlikeFilter, quoteFilterValue } from "./searchFilter";

describe("quoteFilterValue", () => {
  it("wraps the value so separators cannot reach the grammar", () => {
    expect(quoteFilterValue("%a,b%")).toBe('"%a,b%"');
  });

  it("escapes the two characters that could close the quoting", () => {
    expect(quoteFilterValue('a"b')).toBe('"a\\"b"');
    expect(quoteFilterValue("a\\b")).toBe('"a\\\\b"');
    // A trailing backslash must not escape the closing quote.
    expect(quoteFilterValue("a\\")).toBe('"a\\\\"');
  });
});

describe("orIlikeFilter", () => {
  it("builds one clause per column", () => {
    expect(orIlikeFilter(["name", "email"], "ann")).toBe('name.ilike."%ann%",email.ilike."%ann%"');
  });

  it("contains a comma — which used to 400 the whole request", () => {
    // Reproduced live: q="a,b" → "failed to parse logic tree". An admin
    // searching «Іван, Петров» got an error instead of results.
    const filter = orIlikeFilter(["name"], "Іван, Петров")!;
    expect(filter).toBe('name.ilike."%Іван, Петров%"');
    expect(filter.split('"')[1]).toContain(",");
  });

  it("contains a closing paren — which used to return the entire table", () => {
    // Reproduced live: q=")" returned every row in `leads`. The parse broke and
    // the filter was DROPPED rather than rejected — the same silent-drop class
    // as the `+` bug in leadStage.ts, where it would have closed strangers'
    // leads. The paren must end up inside the quotes.
    const filter = orIlikeFilter(["email"], ")")!;
    expect(filter).toBe('email.ilike."%)%"');
  });

  it("returns null for an empty or blank query so the caller skips the filter", () => {
    // Not `%%`: a filter matching everything is indistinguishable from no
    // filter at all, which is how a dropped filter hides.
    expect(orIlikeFilter(["email"], "")).toBeNull();
    expect(orIlikeFilter(["email"], "   ")).toBeNull();
    expect(orIlikeFilter([], "ann")).toBeNull();
  });

  it("trims, because a trailing space from a paste is not part of the name", () => {
    expect(orIlikeFilter(["name"], "  ann  ")).toBe('name.ilike."%ann%"');
  });

  it("leaves ilike wildcards working — an admin's own search box may use them", () => {
    expect(orIlikeFilter(["name"], "a%b")).toBe('name.ilike."%a%b%"');
  });

  it("survives the characters a real contact actually contains", () => {
    expect(orIlikeFilter(["phone"], "+380501112233")).toBe('phone.ilike."%+380501112233%"');
    expect(orIlikeFilter(["email"], "o'brien@example.com")).toBe('email.ilike."%o\'brien@example.com%"');
  });
});
