import { describe, expect, it } from "vitest";
import { closeWonLeadsForPurchase } from "./leadStage";

type Row = { id: string; email?: string | null; phone?: string | null; product_code: string; stage: string };

/** A `leads` table just real enough to exercise the filters this code builds. */
function fakeDb(rows: Row[]) {
  const updates: Array<{ ids: string[]; patch: Record<string, unknown> }> = [];
  const api = {
    rows,
    updates,
    from(table: string) {
      if (table !== "leads") throw new Error(`unexpected table ${table}`);
      let selected = rows;
      const builder: any = {
        select() {
          return builder;
        },
        in(column: string, values: string[]) {
          if (column === "stage") selected = selected.filter((row) => values.includes(row.stage));
          if (column === "id") {
            builder._ids = values;
          }
          return builder;
        },
        eq(column: "email" | "phone", value: string) {
          selected = selected.filter((row) => (row[column] ?? null) === value);
          return builder;
        },
        update(patch: Record<string, unknown>) {
          builder._patch = patch;
          return builder;
        },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) {
          if (builder._patch) {
            const ids: string[] = builder._ids ?? [];
            for (const row of rows) {
              if (ids.includes(row.id) && ["new", "in_progress"].includes(row.stage)) {
                Object.assign(row, builder._patch);
              }
            }
            updates.push({ ids, patch: builder._patch });
            return resolve({ data: [], error: null });
          }
          return resolve({ data: selected, error: null });
        },
      };
      return builder;
    },
  };
  return api;
}

describe("closeWonLeadsForPurchase", () => {
  it("closes an open lead when the buyer bought the thing they asked about", async () => {
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "A@Example.com",
      productCode: "consult",
      scope: "same_product",
    });
    expect(result).toEqual({ closed: 1, reason: "closed" });
    expect(db.rows[0].stage).toBe("won");
  });

  it("does NOT close a consultation request when the person self-serves a different product", async () => {
    // The whole reason the gateway uses `same_product`: they are still owed the
    // answer they asked for, so that lead is not won.
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "a@example.com",
      productCode: "course:reset-day",
      scope: "same_product",
    });
    expect(result.closed).toBe(0);
    expect(db.rows[0].stage).toBe("new");
  });

  it("closes every open lead when a human recorded the sale", async () => {
    // The concierge path: the founder answered a consult request and sold way21.
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "a@example.com",
      productCode: "way21",
      scope: "all_open",
    });
    expect(result.closed).toBe(1);
    expect(db.rows[0].stage).toBe("won");
  });

  it("folds the two spellings of one course, so a legacy lead still closes", async () => {
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "irem", stage: "in_progress" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "a@example.com",
      productCode: "course:irem-gymnastics",
      scope: "same_product",
    });
    expect(result.closed).toBe(1);
  });

  it("never reopens or re-closes a lead that is already closed", async () => {
    const db = fakeDb([
      { id: "l1", email: "a@example.com", product_code: "consult", stage: "lost" },
      { id: "l2", email: "a@example.com", product_code: "consult", stage: "won" },
    ]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "a@example.com",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result).toEqual({ closed: 0, reason: "nothing_open" });
    expect(db.rows.map((row) => row.stage)).toEqual(["lost", "won"]);
  });

  it("is idempotent: a redelivered webhook finds nothing open the second time", async () => {
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "consult", stage: "new" }]);
    const args = { email: "a@example.com", productCode: "consult", scope: "same_product" as const };
    expect((await closeWonLeadsForPurchase(db as never, args)).closed).toBe(1);
    expect((await closeWonLeadsForPurchase(db as never, args)).closed).toBe(0);
  });

  it("does nothing without a contact to match on", async () => {
    const db = fakeDb([{ id: "l1", email: "a@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: null,
      phone: null,
      productCode: "consult",
      scope: "all_open",
    });
    expect(result).toEqual({ closed: 0, reason: "no_contact" });
    expect(db.rows[0].stage).toBe("new");
  });

  it("does not touch other people's leads when the phone contains a plus", async () => {
    /* REGRESSION. This used to build the filter as one `.or()` string, where a
       `+` broke the PostgREST parse and the filter was DISCARDED rather than
       rejected — the read then returned every row in the table and every open
       lead in the database would have been marked won on the first real
       Ukrainian purchase. Caught against production before it shipped. */
    const db = fakeDb([
      { id: "mine", phone: "+380501112233", product_code: "consult", stage: "new" },
      { id: "someone-else", email: "other@example.com", product_code: "consult", stage: "new" },
    ]);
    const result = await closeWonLeadsForPurchase(db as never, {
      phone: "+380501112233",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result.closed).toBe(1);
    expect(db.rows.find((row) => row.id === "mine")!.stage).toBe("won");
    expect(db.rows.find((row) => row.id === "someone-else")!.stage).toBe("new");
  });

  it("matches on phone when that is the only contact the form collected", async () => {
    const db = fakeDb([{ id: "l1", phone: "+380501112233", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      phone: "+380501112233",
      productCode: "consult",
      scope: "same_product",
    });
    expect(result.closed).toBe(1);
  });
});

describe("closing the wrong person's leads", () => {
  it("matches the contact exactly and never by prefix or substring", () => {
    // `.eq`, not `.ilike`: `ann@example.com` must not reach
    // `ann@example.com.attacker.tld`, which is a domain anybody can register.
    const db = fakeDb([
      { id: "victim", email: "ann@example.com", product_code: "consult", stage: "new" },
    ]);
    return closeWonLeadsForPurchase(db as never, {
      email: "ann@example.com.attacker.tld",
      productCode: "consult",
      scope: "all_open",
    }).then((result) => {
      expect(result.closed).toBe(0);
      expect(db.rows[0].stage).toBe("new");
    });
  });

  it("closes only the contact's own leads when several people are waiting", async () => {
    const db = fakeDb([
      { id: "mine", email: "ann@example.com", product_code: "consult", stage: "new" },
      { id: "theirs", email: "bob@example.com", product_code: "consult", stage: "new" },
      { id: "also-theirs", phone: "+380509998877", product_code: "consult", stage: "in_progress" },
    ]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "ann@example.com",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result.closed).toBe(1);
    expect(db.rows.map((row) => row.stage)).toEqual(["won", "new", "in_progress"]);
  });

  it("counts a person found by both email and phone once, not twice", async () => {
    // Two lookups feed one map keyed by id; a duplicate would inflate the count
    // and, worse, suggest two leads closed where there was one.
    const db = fakeDb([
      { id: "l1", email: "ann@example.com", phone: "+380501112233", product_code: "consult", stage: "new" },
    ]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "ann@example.com",
      phone: "+380501112233",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result.closed).toBe(1);
  });

  it("closes nothing on a purchase with no recognisable product under same_product scope", async () => {
    // An empty canonical key must not become a wildcard that matches every lead.
    const db = fakeDb([{ id: "l1", email: "ann@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "ann@example.com",
      productCode: null,
      scope: "same_product",
    });
    expect(result.closed).toBe(0);
    expect(db.rows[0].stage).toBe("new");
  });

  it("treats a whitespace-only contact as no contact at all", async () => {
    const db = fakeDb([{ id: "l1", email: "ann@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "   ",
      phone: "  ",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result).toEqual({ closed: 0, reason: "no_contact" });
  });

  it("normalises the buyer's email the way the form stored it", async () => {
    // A gateway that quotes ANN@Example.COM must still find the lead the form
    // wrote as ann@example.com, or the stage never moves for anybody who typed
    // their address with a capital letter.
    const db = fakeDb([{ id: "l1", email: "ann@example.com", product_code: "consult", stage: "new" }]);
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "  ANN@Example.COM ",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result.closed).toBe(1);
  });
});

describe("failing safe", () => {
  it("reports nothing_open rather than throwing when the read fails", async () => {
    // Every caller is past the point where money moved. A missing column or a
    // permissions change must degrade to "the stage did not move".
    const db = {
      from: () => ({
        select: () => ({
          in: () => ({ eq: async () => ({ data: null, error: { message: "column does not exist" } }) }),
        }),
      }),
    };
    const result = await closeWonLeadsForPurchase(db as never, {
      email: "ann@example.com",
      productCode: "consult",
      scope: "all_open",
    });
    expect(result).toEqual({ closed: 0, reason: "nothing_open" });
  });

  it("never throws even when the client itself blows up", async () => {
    const db = {
      from: () => {
        throw new Error("connection refused");
      },
    };
    await expect(
      closeWonLeadsForPurchase(db as never, {
        email: "ann@example.com",
        productCode: "consult",
        scope: "all_open",
      })
    ).resolves.toEqual({ closed: 0, reason: "nothing_open" });
  });
});
