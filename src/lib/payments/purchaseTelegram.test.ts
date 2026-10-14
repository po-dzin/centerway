import { describe, expect, it } from "vitest";

import { RETURN_LINK_WINDOW_MS, returnPageMayOfferLink } from "./purchaseTelegram";

const NOW = Date.parse("2026-10-14T18:00:00Z");
const paid = { id: "o1", status: "paid", created_at: "2026-10-14T17:50:00Z", customer_id: "c1" };

describe("Telegram link on the page after payment", () => {
  it("is offered right after a paid order", () => {
    expect(returnPageMayOfferLink(paid, false, NOW)).toBe(true);
  });

  it("is not offered for an order that is not paid, has no buyer, or is unknown", () => {
    expect(returnPageMayOfferLink({ ...paid, status: "created" }, false, NOW)).toBe(false);
    expect(returnPageMayOfferLink({ ...paid, customer_id: null }, false, NOW)).toBe(false);
    expect(returnPageMayOfferLink(null, false, NOW)).toBe(false);
  });

  it("is not offered once the buyer's chat is linked", () => {
    expect(returnPageMayOfferLink(paid, true, NOW)).toBe(false);
  });

  it("stops being offered a day after the order, when the URL is no longer the buyer's own return", () => {
    const old = { ...paid, created_at: new Date(NOW - RETURN_LINK_WINDOW_MS - 1000).toISOString() };
    expect(returnPageMayOfferLink(old, false, NOW)).toBe(false);
  });
});
