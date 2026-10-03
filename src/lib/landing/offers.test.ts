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

const { resolveIremLandingOffer } = await import("./offers");

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
