import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import type { supabaseAdmin } from "@/lib/supabaseAdmin";

import { resolveInvoiceShare, resolveInvoiceSplits } from "./invoiceSplits";

const db = new FakeSupabase();
const sb = db as unknown as ReturnType<typeof supabaseAdmin>;

beforeEach(() => {
  db.tables = {
    experience_offers: [{ id: "off-1", code: "way21", experience_id: "exp-1", share_pct: null }],
    offer_aliases: [{ code: "reboot", offer_id: "off-1" }],
    experiences: [{ id: "exp-1", author_profile_id: "auth-1", title: "Шлях 21" }],
    author_payout_accounts: [
      { author_id: "auth-1", receiver_ref: " i111 ", gateway: "liqpay", default_share_pct: 60, active: true },
    ],
  };
  db.failures = {};
});

const ask = (over: Partial<{ productCode: string; amount: number }> = {}) =>
  resolveInvoiceSplits(sb, { productCode: "way21", amount: 4100, gateway: "liqpay", ...over });

describe("resolveInvoiceSplits", () => {
  it("gives the author their default share, by the same rounding the database uses", async () => {
    expect(await ask()).toEqual([{ receiverRef: "i111", amount: 2460, description: "Шлях 21: частка автора" }]);
    expect(await ask({ amount: 999.99 })).toEqual([expect.objectContaining({ amount: 599.99 })]);
  });

  it("prefers the offer's own share, and finds the offer by an old code too", async () => {
    db.tables.experience_offers![0]!.share_pct = 50;
    expect(await ask({ productCode: "REBOOT" })).toEqual([expect.objectContaining({ amount: 2050 })]);
  });

  it("routes nothing when any piece is missing", async () => {
    db.tables.author_payout_accounts![0]!.gateway = "wfp";
    expect(await ask()).toEqual([]);
    db.tables.author_payout_accounts![0]!.gateway = "liqpay";
    db.tables.author_payout_accounts![0]!.receiver_ref = null;
    expect(await ask()).toEqual([]);
    db.tables.author_payout_accounts![0]!.receiver_ref = "i111";
    db.tables.author_payout_accounts![0]!.active = false;
    expect(await ask()).toEqual([]);
    db.tables.author_payout_accounts![0]!.active = true;
    db.tables.experiences![0]!.author_profile_id = null;
    expect(await ask()).toEqual([]);
    expect(await ask({ productCode: "unknown" })).toEqual([]);
  });

  it("routes nothing when the share leaves the platform nothing", async () => {
    db.tables.experience_offers![0]!.share_pct = 100;
    expect(await ask()).toEqual([]);
  });

  it("answers empty when a read fails, so the checkout still opens", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.failures = { "experience_offers:select": "boom" };
    expect(await ask()).toEqual([]);
  });
});

describe("resolveInvoiceShare", () => {
  const share = (ref: string | null) =>
    resolveInvoiceShare(sb, { productCode: "way21", amount: 4100, gateway: "liqpay", ref });

  beforeEach(() => {
    db.tables.experience_offers![0]!.share_pct = 50;
    db.tables.author_payout_accounts![0]!.own_share_pct = 90;
    db.tables.author_links = [
      { tag: "anna-ig-reel", author_id: "auth-1" },
      { tag: "other-post", author_id: "auth-2" },
    ];
  });

  it("gives the author's own share when the buyer came by the author's link", async () => {
    expect(await share("anna-ig-reel")).toEqual({
      splits: [expect.objectContaining({ amount: 3690 })],
      snapshot: { pct: 90, source: "author" },
    });
  });

  it("keeps the platform share for no link, a stranger's link, or another author's link", async () => {
    for (const ref of [null, "friend-ref", "other-post"]) {
      expect(await share(ref)).toEqual({
        splits: [expect.objectContaining({ amount: 2050 })],
        snapshot: { pct: 50, source: "platform" },
      });
    }
  });

  it("falls back to the platform share when the author's own share is not set", async () => {
    db.tables.author_payout_accounts![0]!.own_share_pct = null;
    expect((await share("anna-ig-reel")).snapshot).toEqual({ pct: 50, source: "author" });
  });

  it("still fixes the share on the order when nothing can be split at the gateway", async () => {
    db.tables.author_payout_accounts![0]!.receiver_ref = null;
    expect(await share("anna-ig-reel")).toEqual({ splits: [], snapshot: { pct: 90, source: "author" } });
  });
});
