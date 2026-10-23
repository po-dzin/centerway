import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  customers: [] as Record<string, unknown>[],
  orders: [] as Record<string, unknown>[],
  audit: [] as Record<string, unknown>[],
  updates: [] as { id: string; patch: Record<string, unknown> }[],
  upsert: vi.fn(),
  sellable: vi.fn(),
}));

function fakeDb() {
  return {
    from(table: string) {
      if (table === "orders") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.orders.push(row);
            return { error: null };
          },
        };
      }
      if (table === "audit_log") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.audit.push(row);
            return { error: null };
          },
        };
      }
      return {
        select: () => {
          const pick = (id: string) => state.customers.find((c) => c.id === id) ?? null;
          return {
            eq: (_c: string, id: string) => ({
              maybeSingle: async () => ({ data: pick(id), error: null }),
              single: async () => ({ data: pick(id), error: null }),
            }),
          };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            state.updates.push({ id, patch });
            return { error: null };
          },
        }),
      };
    },
  };
}

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => fakeDb() }));
vi.mock("@/lib/platform/customerIdentity", () => ({ upsertCustomerByContact: state.upsert }));
vi.mock("@/lib/admin/productOffers", () => ({ sellableProduct: state.sellable }));
vi.mock("@/lib/platform/leadStage", () => ({ closeWonLeadsForPurchase: vi.fn(async () => undefined) }));

import { OFFLINE_PRODUCT_CODE, recordProductSale } from "./manualSale";

const NOW = new Date("2026-10-23T10:00:00.000Z");

beforeEach(() => {
  state.customers = [{ id: "c1", email: "a@b.ua", display_name: null }];
  state.orders = [];
  state.audit = [];
  state.updates = [];
  state.upsert.mockReset();
  state.sellable.mockReset();
});

describe("recordProductSale", () => {
  it("writes a paid manual order for a registered product on the given card", async () => {
    state.sellable.mockResolvedValue({ id: "exp-herbs", code: "herbs-detox", title: "Трав'яний збір" });
    const sale = await recordProductSale(
      {
        customerId: "c1",
        productCode: "herbs-detox",
        amount: 450,
        currency: "UAH",
        paidOn: "2026-10-20",
        actorId: "u",
      },
      NOW,
    );
    expect(sale.orderRef).toMatch(/^manual_herbs-detox_20261023_/);
    expect(state.orders[0]).toMatchObject({
      product_code: "herbs-detox",
      experience_id: "exp-herbs",
      status: "paid",
      customer_id: "c1",
      amount: 450,
      created_at: "2026-10-20T12:00:00.000Z",
      meta: { manual: true, title: "Трав'яний збір", note: null },
    });
    expect(state.audit[0]).toMatchObject({ action: "order.manual.product" });
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("refuses a code that is not a standalone product, so no course opens by this door", async () => {
    state.sellable.mockResolvedValue(null);
    await expect(
      recordProductSale({ customerId: "c1", productCode: "way21", amount: 100, currency: "UAH", actorId: "u" }, NOW),
    ).rejects.toThrow("product_unknown");
    expect(state.orders).toHaveLength(0);
  });

  it("finds or makes the person by phone, names a new card and records its first touch", async () => {
    state.upsert.mockResolvedValue({ id: "c1", created: true });
    await recordProductSale(
      {
        person: { name: "Оля", phone: "067 123 45 67" },
        otherTitle: "Олія кунжутна",
        amount: 300,
        currency: "UAH",
        actorId: "u",
      },
      NOW,
    );
    expect(state.upsert).toHaveBeenCalledWith(expect.anything(), { email: undefined, phone: "067 123 45 67" });
    expect(state.updates[0]).toEqual({
      id: "c1",
      patch: {
        display_name: "Оля",
        first_touch: { channel: "offline", medium: "manual", at: NOW.toISOString() },
      },
    });
    expect(state.orders[0]).toMatchObject({ product_code: OFFLINE_PRODUCT_CODE, meta: { title: "Олія кунжутна" } });
  });

  it("leaves an existing card's first touch alone", async () => {
    state.customers = [{ id: "c1", email: "a@b.ua", display_name: "Ірина" }];
    state.upsert.mockResolvedValue({ id: "c1", created: false });
    await recordProductSale(
      { person: { name: "Іра", email: "a@b.ua" }, otherTitle: "Спеції", amount: 120, currency: "UAH", actorId: "u" },
      NOW,
    );
    expect(state.updates).toHaveLength(0);
  });

  it("refuses a sale with no amount, no product, a future date or nobody to sell to", async () => {
    await expect(
      recordProductSale({ customerId: "c1", otherTitle: "x", amount: 0, currency: "UAH", actorId: "u" }, NOW),
    ).rejects.toThrow("amount_invalid");
    await expect(
      recordProductSale({ customerId: "c1", amount: 10, currency: "UAH", actorId: "u" }, NOW),
    ).rejects.toThrow("product_required");
    await expect(
      recordProductSale(
        { customerId: "c1", otherTitle: "x", amount: 10, currency: "UAH", paidOn: "2026-12-01", actorId: "u" },
        NOW,
      ),
    ).rejects.toThrow("paid_on_future");
    state.upsert.mockResolvedValue({ id: null, created: false });
    await expect(
      recordProductSale(
        { person: { name: "Без контакту" }, otherTitle: "x", amount: 10, currency: "UAH", actorId: "u" },
        NOW,
      ),
    ).rejects.toThrow("contact_required");
    expect(state.orders).toHaveLength(0);
  });
});
