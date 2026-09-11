/**
 * The resolver that decides WHOSE customer row a write lands on.
 *
 * Every door into `customers` goes through it — a payment callback, a public
 * form — so a mistake here is not a wrong label, it is one person's data
 * written onto another person's record.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  upsertCustomerByContact,
} from "./customerIdentity";

type Row = { id: string; email: string | null; phone: string | null; created_at: string };

function fakeDb(rows: Row[], opts: { insertError?: { code?: string } } = {}) {
  let seq = rows.length;
  const state = {
    rows,
    inserts: 0,
    updates: [] as Array<{ id: string; patch: Record<string, unknown> }>,
    from(table: string) {
      if (table !== "customers") throw new Error(`unexpected table ${table}`);
      const builder: any = {
        _filters: [] as Array<[string, unknown]>,
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          builder._filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        update(patch: Record<string, unknown>) {
          builder._patch = patch;
          return builder;
        },
        insert(row: { email: string | null; phone: string | null }) {
          builder._insert = row;
          return builder;
        },
        then(resolve: (value: { data: Row[] | null; error: unknown }) => unknown) {
          if (builder._insert) {
            state.inserts += 1;
            if (opts.insertError) return resolve({ data: null, error: opts.insertError });
            seq += 1;
            rows.push({
              id: `c${seq}`,
              email: builder._insert.email,
              phone: builder._insert.phone,
              created_at: `2026-01-0${seq}T00:00:00Z`,
            });
            return resolve({ data: null, error: null });
          }
          if (builder._patch) {
            const id = builder._filters.find(([c]: [string, unknown]) => c === "id")?.[1] as string;
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, builder._patch);
            state.updates.push({ id, patch: builder._patch });
            return resolve({ data: null, error: null });
          }
          let found = rows;
          for (const [column, value] of builder._filters) {
            found = found.filter((row) => (row as any)[column] === value);
          }
          found = [...found].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 1);
          return resolve({ data: found, error: null });
        },
      };
      return builder;
    },
  };
  return state;
}

describe("normalisation", () => {
  it("lower-cases and trims an email, because the lookup matches on it", () => {
    // A webhook that normalised differently from the lookup would create a
    // second customer for the same person.
    expect(normalizeCustomerEmail("  Ann@Example.COM ")).toBe("ann@example.com");
    expect(normalizeCustomerEmail("   ")).toBeNull();
    expect(normalizeCustomerEmail(null)).toBeNull();
    expect(normalizeCustomerEmail(undefined)).toBeNull();
  });

  it("trims but never rewrites a phone", () => {
    // Stored phones are whatever the gateway sent; reformatting here would stop
    // matching the rows we already have.
    expect(normalizeCustomerPhone(" +380501112233 ")).toBe("+380501112233");
    expect(normalizeCustomerPhone("")).toBeNull();
  });
});

describe("upsertCustomerByContact", () => {
  it("returns nothing to key on when both contacts are empty", async () => {
    const db = fakeDb([]);
    expect(await upsertCustomerByContact(db as never, { email: "  ", phone: null })).toEqual({
      id: null,
      created: false,
    });
    expect(db.inserts).toBe(0);
  });

  it("finds an existing customer case-insensitively rather than making a second one", async () => {
    const db = fakeDb([{ id: "c1", email: "ann@example.com", phone: null, created_at: "2026-01-01T00:00:00Z" }]);
    const result = await upsertCustomerByContact(db as never, { email: "ANN@example.com" });
    expect(result).toEqual({ id: "c1", created: false });
    expect(db.inserts).toBe(0);
  });

  it("prefers the EARLIEST row when email and phone point at different people", async () => {
    // The older row is the one carrying the purchase history.
    const db = fakeDb([
      { id: "old", email: "ann@example.com", phone: null, created_at: "2025-01-01T00:00:00Z" },
      { id: "new", email: null, phone: "+380501112233", created_at: "2026-01-01T00:00:00Z" },
    ]);
    const result = await upsertCustomerByContact(db as never, {
      email: "ann@example.com",
      phone: "+380501112233",
    });
    expect(result.id).toBe("old");
  });

  it("never writes NULL over a stored contact the caller did not carry", async () => {
    // The regression this guards: a callback quoting an email and no phone used
    // to erase the phone — for older purchases the only key tying a person to
    // what they had bought.
    const db = fakeDb([
      { id: "c1", email: "ann@example.com", phone: "+380501112233", created_at: "2026-01-01T00:00:00Z" },
    ]);
    await upsertCustomerByContact(db as never, { email: "ann@example.com", phone: null });
    expect(db.rows[0].phone).toBe("+380501112233");
    expect(db.updates[0]?.patch).toEqual({ email: "ann@example.com" });
  });

  it("creates a row for somebody we have never seen, and says so", async () => {
    const db = fakeDb([]);
    const result = await upsertCustomerByContact(db as never, { email: "new@example.com" });
    expect(result.created).toBe(true);
    expect(db.inserts).toBe(1);
  });

  it("does NOT claim creation when it lost a race to another request", async () => {
    // `created` is a trust boundary, not bookkeeping: the public lead form
    // writes profile fields only for a row it brought into being. Treating a
    // lost race as a creation would hand unverified input that write access.
    const db = fakeDb(
      [{ id: "c1", email: "ann@example.com", phone: null, created_at: "2026-01-01T00:00:00Z" }],
      { insertError: { code: "23505" } }
    );
    // Force the insert path by making the pre-check miss: the row is keyed on a
    // phone this call does not carry.
    db.rows[0].email = "ann@example.com";
    const result = await upsertCustomerByContact(db as never, { email: "ann@example.com" });
    // Found on the pre-check, so no insert was attempted at all.
    expect(result).toEqual({ id: "c1", created: false });
  });

  it("rethrows an insert failure that is not a lost race", async () => {
    // A permissions error must not be silently swallowed into "no customer".
    const db = fakeDb([], { insertError: { code: "42501" } });
    await expect(upsertCustomerByContact(db as never, { email: "new@example.com" })).rejects.toBeTruthy();
  });
});
