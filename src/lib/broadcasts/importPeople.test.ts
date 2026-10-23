import { describe, expect, it } from "vitest";

import { linkImportedPeople } from "./importPeople";

/**
 * A two-table fake that imitates the database's link trigger: a subscription
 * whose `customer_id` is (re)set to null picks up the card with its address.
 */
function fakeDb(opts: {
  cards: { id: string; email: string; tags: string[] }[];
  subs: { address: string; customer_id: string | null }[];
}) {
  const cards = opts.cards.map((c) => ({ ...c, display_name: null as string | null, first_touch: null as unknown }));
  const subs = opts.subs;
  const tagRows: Record<string, unknown>[] = [];
  let seq = 0;
  const relink = (addresses: string[]) => {
    for (const sub of subs) {
      if (sub.customer_id || !addresses.includes(sub.address)) continue;
      sub.customer_id = cards.find((c) => c.email === sub.address)?.id ?? null;
    }
  };
  return {
    cards,
    subs,
    tagRows,
    from(table: string) {
      if (table === "messaging_subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_c: string, list: string[]) => ({
                data: subs.filter((s) => list.includes(s.address)),
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ is: () => ({ in: async (_c: string, list: string[]) => (relink(list), { error: null }) }) }),
          }),
        };
      }
      if (table === "customer_tags") {
        return { upsert: async (rows: Record<string, unknown>[]) => (tagRows.push(...rows), { error: null }) };
      }
      return {
        insert: (rows: { email: string; display_name: string | null; first_touch: unknown }[]) => ({
          select: async () => {
            const made = rows.map((row) => ({ id: `new${++seq}`, tags: [] as string[], ...row }));
            cards.push(...made);
            return { data: made.map((m) => ({ id: m.id })), error: null };
          },
        }),
        select: () => ({
          in: async (_c: string, ids: string[]) => ({ data: cards.filter((c) => ids.includes(c.id)), error: null }),
        }),
        update: (patch: { tags: string[] }) => ({
          eq: async (_c: string, id: string) => {
            const card = cards.find((c) => c.id === id);
            if (card) card.tags = patch.tags;
            return { error: null };
          },
        }),
      };
    },
  };
}

const NOW = () => new Date("2026-10-23T18:00:00Z");

describe("linkImportedPeople", () => {
  it("gives a card to an address nobody knew, with the base as first touch, and tags everyone", async () => {
    const db = fakeDb({
      cards: [{ id: "buyer", email: "olena@example.com", tags: ["buyer"] }],
      subs: [
        { address: "olena@example.com", customer_id: "buyer" },
        { address: "new@example.com", customer_id: null },
      ],
    });
    const result = await linkImportedPeople(
      db as never,
      [
        { address: "olena@example.com", name: "Олена" },
        { address: "new@example.com", name: "Марина" },
      ],
      "smartsender_import",
      NOW,
    );
    expect(result).toEqual({ linked: 2, created: 1 });
    const made = db.cards.find((c) => c.email === "new@example.com");
    expect(made?.display_name).toBe("Марина");
    expect(made?.first_touch).toEqual({ channel: "smartsender", medium: "import", at: "2026-10-23T18:00:00.000Z" });
    expect(db.subs.every((s) => s.customer_id)).toBe(true);
    expect(db.cards.map((c) => c.tags)).toEqual([["buyer", "smartsender"], ["smartsender"]]);
  });

  it("never renames a card that already existed", async () => {
    const db = fakeDb({
      cards: [{ id: "buyer", email: "olena@example.com", tags: [] }],
      subs: [{ address: "olena@example.com", customer_id: "buyer" }],
    });
    await linkImportedPeople(db as never, [{ address: "olena@example.com", name: "Not Olena" }], "csv_import", NOW);
    expect(db.cards[0]?.display_name).toBeNull();
    // A plain file leaves no tag behind.
    expect(db.tagRows).toEqual([]);
  });
});
