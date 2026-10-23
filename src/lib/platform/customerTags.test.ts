import { describe, expect, it } from "vitest";

import { addCustomerTags, normalizeTag } from "./customerTags";

describe("normalizeTag", () => {
  it("keeps Latin tags and lower-cases them (G 23.10: теги латиницей)", () => {
    expect(normalizeTag(" Buyer ")).toBe("buyer");
    expect(normalizeTag("stream-2026-11")).toBe("stream-2026-11");
    expect(normalizeTag("dosha_vata")).toBe("dosha_vata");
  });

  it("drops what a broadcast filter could never match on purpose", () => {
    expect(normalizeTag("покупець")).toBeNull();
    expect(normalizeTag("two words")).toBeNull();
    expect(normalizeTag("-lead")).toBeNull();
    expect(normalizeTag("")).toBeNull();
  });
});

function fakeDb(customers: { id: string; tags: string[] }[]) {
  const history: Record<string, unknown>[] = [];
  const updates: { id: string; tags: string[] }[] = [];
  const order: string[] = [];
  return {
    history,
    updates,
    order,
    from(table: string) {
      if (table === "customer_tags") {
        return {
          upsert: async (rows: Record<string, unknown>[]) => {
            order.push("history");
            history.push(...rows);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({
          in: async (_c: string, ids: string[]) => ({ data: customers.filter((c) => ids.includes(c.id)), error: null }),
        }),
        update: (patch: { tags: string[] }) => ({
          eq: async (_c: string, id: string) => {
            order.push("list");
            updates.push({ id, tags: patch.tags });
            return { error: null };
          },
        }),
      };
    },
  };
}

describe("addCustomerTags", () => {
  it("records the source first, then adds only the missing tags to the list", async () => {
    const db = fakeDb([
      { id: "a", tags: ["buyer"] },
      { id: "b", tags: ["smartsender"] },
    ]);
    await addCustomerTags(db as never, ["a", "b", "a"], ["smartsender", "Ой"], "import:smartsender");
    expect(db.history).toEqual([
      { customer_id: "a", tag: "smartsender", source: "import:smartsender", created_by: null },
      { customer_id: "b", tag: "smartsender", source: "import:smartsender", created_by: null },
    ]);
    expect(db.updates).toEqual([{ id: "a", tags: ["buyer", "smartsender"] }]);
    expect(db.order[0]).toBe("history");
  });

  it("does nothing when no tag survives the shape check", async () => {
    const db = fakeDb([{ id: "a", tags: [] }]);
    await addCustomerTags(db as never, ["a"], ["покупець"], "admin");
    expect(db.history).toEqual([]);
    expect(db.updates).toEqual([]);
  });
});
