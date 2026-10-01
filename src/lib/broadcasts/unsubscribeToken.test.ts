import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribeToken";

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret";
});
afterEach(() => {
  delete process.env.UNSUBSCRIBE_SECRET;
});

describe("unsubscribe token", () => {
  it("round-trips the address and the campaign", () => {
    const token = createUnsubscribeToken({ address: "a@b.co", broadcastId: "b-1" });
    expect(verifyUnsubscribeToken(token)).toEqual({ address: "a@b.co", broadcastId: "b-1" });
  });

  it("refuses a token whose address was swapped", () => {
    const token = createUnsubscribeToken({ address: "a@b.co", broadcastId: null });
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ a: "victim@b.co", b: null })).toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("refuses a token signed with another key", () => {
    const token = createUnsubscribeToken({ address: "a@b.co", broadcastId: null });
    process.env.UNSUBSCRIBE_SECRET = "rotated";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("refuses garbage", () => {
    for (const bad of [null, "", "abc", ".", "a.b", "x".repeat(3000)]) expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it("falls back to a key derived from the service role", () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    const token = createUnsubscribeToken({ address: "a@b.co", broadcastId: null });
    expect(verifyUnsubscribeToken(token)?.address).toBe("a@b.co");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
});
