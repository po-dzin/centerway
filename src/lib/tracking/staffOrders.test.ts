import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_CHECKOUT_EVENT, isStaffOrder } from "./staffOrders";

/**
 * A stand-in for the one query `isStaffOrder` makes. It records the filters so the
 * test can assert we ask about this order and this event type, and nothing wider.
 */
function fakeSupabase(result: { data?: { id: string } | null; error?: { message: string } }) {
  const filters: Array<[string, string]> = [];
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      filters.push([column, value]);
      return builder;
    },
    limit: () => builder,
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  };
  const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  return { client, filters, from: client.from as unknown as ReturnType<typeof vi.fn> };
}

describe("isStaffOrder", () => {
  it("recognises an order the checkout marked as staff", async () => {
    const { client, filters, from } = fakeSupabase({ data: { id: "evt-1" } });

    await expect(isStaffOrder(client, "reset-day_20260828_ab12")).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith("events");
    expect(filters).toEqual([
      ["order_ref", "reset-day_20260828_ab12"],
      ["type", STAFF_CHECKOUT_EVENT],
    ]);
  });

  it("treats an unmarked order as a real customer's", async () => {
    const { client } = fakeSupabase({ data: null });

    await expect(isStaffOrder(client, "reset-day_20260828_ab12")).resolves.toBe(false);
  });

  it("fails open when the lookup errors, so a real Purchase is never dropped", async () => {
    const { client } = fakeSupabase({ error: { message: "connection reset" } });

    await expect(isStaffOrder(client, "reset-day_20260828_ab12")).resolves.toBe(false);
  });

  it("fails open when the client throws", async () => {
    const client = {
      from: () => {
        throw new Error("boom");
      },
    } as unknown as SupabaseClient;

    await expect(isStaffOrder(client, "any-order")).resolves.toBe(false);
  });
});
