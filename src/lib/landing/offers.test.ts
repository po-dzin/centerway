/**
 * A personal IREM price is carried by an active, unexpired token and nothing
 * else. A cancelled or consumed token used to keep its discount until the
 * deadline, because the status was read only to activate a draft (meta-audit
 * 2026-09-30).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/platform/offers", () => ({
  loadPayableOffer: async () => ({ amount: 3950, currency: "UAH" }),
}));

const { IREM_OFFER_CODE, resolveIremLandingOffer, resolvePersonalPrice } = await import("./offers");

const HOUR = 60 * 60 * 1000;
const token = (status: string, expiresInHours = 24) => ({
  token: "tok",
  product_code: "irem",
  offer_id: "irem_personal",
  status,
  recipient_key: "r",
  channel: null,
  campaign: null,
  amount: 2900,
  old_amount: 3950,
  currency: "UAH",
  issued_at: new Date(Date.now() - HOUR).toISOString(),
  expires_at: new Date(Date.now() + expiresInHours * HOUR).toISOString(),
  metadata: {},
});

beforeEach(() => {
  db.tables = { personal_offer_tokens: [] };
});

describe("resolveIremLandingOffer", () => {
  it("applies the personal price of an active token before its deadline", async () => {
    db.tables.personal_offer_tokens = [token("active")];
    expect(await resolveIremLandingOffer({ offer_token: "tok" })).toMatchObject({ offerApplied: true, amount: 2900 });
  });

  it("does not apply an active token past its deadline", async () => {
    db.tables.personal_offer_tokens = [token("active", -1)];
    expect(await resolveIremLandingOffer({ offer_token: "tok" })).toMatchObject({
      offerApplied: false,
      offerExpired: true,
      amount: 3950,
    });
  });

  it("does not apply a consumed or expired token, even inside the window", async () => {
    for (const status of ["consumed", "expired"]) {
      db.tables.personal_offer_tokens = [token(status)];
      expect(await resolveIremLandingOffer({ offer_token: "tok" })).toMatchObject({
        offerApplied: false,
        offerExpired: true,
        amount: 3950,
      });
    }
  });

  it("offers nothing for a cancelled token", async () => {
    db.tables.personal_offer_tokens = [token("cancelled")];
    expect(await resolveIremLandingOffer({ offer_token: "tok" })).toMatchObject({
      offerApplied: false,
      offerExpired: false,
      amount: 3950,
    });
  });
});

describe("resolvePersonalPrice", () => {
  it("gives the token's price on the IREM offer", async () => {
    db.tables.personal_offer_tokens = [token("active")];
    expect(await resolvePersonalPrice(IREM_OFFER_CODE, { offer_token: "tok" })).toEqual({
      offerToken: "tok",
      amount: 2900,
      currency: "UAH",
      oldAmount: 3950,
    });
  });

  it("gives nothing without a token, for another product, or for a spent token", async () => {
    db.tables.personal_offer_tokens = [token("active")];
    expect(await resolvePersonalPrice(IREM_OFFER_CODE, {})).toBeNull();
    expect(await resolvePersonalPrice("course:way21", { offer_token: "tok" })).toBeNull();
    db.tables.personal_offer_tokens = [token("consumed")];
    expect(await resolvePersonalPrice(IREM_OFFER_CODE, { offer_token: "tok" })).toBeNull();
  });
});

describe("percentage promos for every payable format", () => {
  it.each(["course:way21", "way21-group", IREM_OFFER_CODE])(
    "snapshots and resolves a manual discount for %s",
    async (code) => {
      const { issueDiscountPersonalOffer } = await import("./offers");
      const issued = await issueDiscountPersonalOffer({
        productCode: code,
        programSlug: "way21",
        recipientKey: "email:a@example.com",
        discountPercent: 25,
        amount: 4100,
        currency: "UAH",
      });
      expect(issued).toMatchObject({ amount: 3075, oldAmount: 4100, status: "draft", expiresAt: null });
      const url = new URL(issued.landingUrl);
      expect(url.pathname).toBe("/go/way21");
      expect(url.searchParams.get("offer_code")).toBe(code);
      const resolved = await resolvePersonalPrice(code, { offer_token: issued.offerToken });
      expect(resolved).toMatchObject({ amount: 3075, oldAmount: 4100, currency: "UAH" });
      const deadline = resolved?.expiresAt;
      expect(Date.parse(deadline!) - Date.now()).toBeGreaterThan(47 * HOUR);
      expect(await resolvePersonalPrice(code, { offer_token: issued.offerToken })).toMatchObject({
        expiresAt: deadline,
      });
      expect(await resolvePersonalPrice("other-format", { offer_token: issued.offerToken })).toBeNull();
    },
  );
  it.each([0, 100, 1.5, NaN])("rejects an invalid discount %s without writing tokens", async (discountPercent) => {
    const { issueDiscountPersonalOffer } = await import("./offers");
    await expect(
      issueDiscountPersonalOffer({
        productCode: "way21-group",
        programSlug: "way21",
        recipientKey: "r",
        discountPercent,
        amount: 4100,
        currency: "UAH",
      }),
    ).rejects.toThrow("discount_percent_invalid");
    expect(db.rows("personal_offer_tokens")).toHaveLength(0);
  });
  it.each(["consumed", "cancelled", "expired"])("never applies a %s percentage token", async (status) => {
    db.tables.personal_offer_tokens = [{ ...token(status), product_code: "way21-group" }];
    expect(await resolvePersonalPrice("way21-group", { offer_token: "tok" })).toBeNull();
  });
  it("never applies a percentage token after its deadline", async () => {
    db.tables.personal_offer_tokens = [{ ...token("active", -1), product_code: "way21-group" }];
    expect(await resolvePersonalPrice("way21-group", { offer_token: "tok" })).toBeNull();
  });
});
