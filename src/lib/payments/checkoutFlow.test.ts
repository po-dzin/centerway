import { describe, expect, it } from "vitest";
import { persistLeadBestEffort, type LeadRecord } from "@/lib/payments/checkoutFlow";

/** A leads table that remembers what was inserted and answers the dedup query
    by applying the `.eq` filters it was given, as the real table would. */
function fakeLeads() {
  const rows: Array<Record<string, unknown>> = [];
  const sb = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        rows.push({ ...row, created_at: new Date().toISOString() });
        return { error: null };
      },
      select: () => {
        const filters: Array<[string, unknown]> = [];
        const chain = {
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return chain;
          },
          order: () => chain,
          limit: async () => ({
            data: rows.filter((row) =>
              filters.every(([column, value]) =>
                column.includes("->>")
                  ? (row.payload as Record<string, unknown>)[column.split("->>")[1] as string] === value
                  : row[column] === value,
              ),
            ),
            error: null,
          }),
        };
        return chain;
      },
    }),
  };
  return { sb: sb as never, rows };
}

const lead = (authorSlug: string): LeadRecord => ({
  order_ref: `ref-${authorSlug}`,
  product_code: "consult" as LeadRecord["product_code"],
  source: "platform_author_consult",
  name: "Ім'я",
  email: "a@example.com",
  phone: null,
  payload: { author_slug: authorSlug },
});

describe("persistLeadBestEffort", () => {
  it("keeps one request per author for the same contact", async () => {
    const { sb, rows } = fakeLeads();
    expect(await persistLeadBestEffort(sb, lead("one"))).toBe("leads");
    expect(await persistLeadBestEffort(sb, lead("two"))).toBe("leads");
    expect(rows).toHaveLength(2);
  });

  it("still drops an immediate repeat to the same author", async () => {
    const { sb, rows } = fakeLeads();
    await persistLeadBestEffort(sb, lead("one"));
    expect(await persistLeadBestEffort(sb, lead("one"))).toBe("leads_deduped");
    expect(rows).toHaveLength(1);
  });
});
