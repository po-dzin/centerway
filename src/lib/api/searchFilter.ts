/**
 * Building a PostgREST `or=` expression out of a search box, safely.
 *
 * `.or()` takes a filter expression as a STRING, so every admin search that
 * interpolated the query directly was letting the typist edit the query's
 * grammar. Against production, on the real `leads` table:
 *
 *   q = "a,b"  → 400, "failed to parse logic tree" — a comma is the clause
 *                separator, so an admin searching «Іван, Петров» got an error
 *                instead of results.
 *   q = ")"    → EVERY ROW IN THE TABLE. The parse breaks and the filter is
 *                dropped rather than rejected — the same silent-drop failure a
 *                `+` produced in `leadStage.ts`, where it would have closed
 *                other people's leads.
 *
 * PostgREST lets a value be double-quoted, and a quoted value may contain the
 * separators. Quote it, escape `"` and `\` inside it, and the typist can no
 * longer reach the grammar — the worst they can do is search for a odd string
 * and find nothing.
 *
 * `%` and `_` are deliberately NOT escaped: this builds `ilike` filters, and
 * wildcard search from an admin's own search box is a feature, not an injection
 * — the value stays inside its quotes either way.
 */

/** Escapes a value for use inside a double-quoted PostgREST filter value. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

/**
 * An `or=` expression matching `query` against every column, case-insensitively
 * and anywhere in the value. Returns null when there is nothing to search for,
 * so callers can simply skip the filter rather than send `%%` and match all.
 */
export function orIlikeFilter(columns: readonly string[], query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || columns.length === 0) return null;
  const value = quoteFilterValue(`%${trimmed}%`);
  return columns.map((column) => `${column}.ilike.${value}`).join(",");
}
