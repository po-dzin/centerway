/**
 * Handing a signed-in account the purchases made under its address.
 *
 * The case this file was written for: the address was a LIKE pattern, and `_`
 * matched any character, so the verified owner of ivan_petrov@x was handed the
 * purchases of ivan.petrov@x (meta-audit 2026-09-30). The in-memory database
 * reads LIKE the way Postgres does, so the test fails the way production did.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));

const { linkPurchasesToAccount } = await import("./linkPurchases");

beforeEach(() => {
  db.tables = {
    customers: [
      { id: "c-dot", email: "ivan.petrov@example.com", auth_user_id: null },
      { id: "c-own", email: "Ivan_Petrov@Example.com", auth_user_id: null },
      { id: "c-taken", email: "ivan_petrov@example.com", auth_user_id: "someone-else" },
    ],
  };
});

describe("linkPurchasesToAccount", () => {
  it("links the account's own address, in any case, and nothing that merely looks like it", async () => {
    const result = await linkPurchasesToAccount({
      authUserId: "me",
      email: "ivan_petrov@example.com",
      emailVerified: true,
    });
    expect(result).toEqual({ linked: 1, reason: "linked" });
    const owner = (id: string) => db.tables.customers!.find((row) => row.id === id)!.auth_user_id;
    expect(owner("c-own")).toBe("me");
    expect(owner("c-dot")).toBeNull();
    expect(owner("c-taken")).toBe("someone-else");
  });

  it("links nothing for an address the provider has not verified", async () => {
    const result = await linkPurchasesToAccount({
      authUserId: "me",
      email: "ivan.petrov@example.com",
      emailVerified: false,
    });
    expect(result).toEqual({ linked: 0, reason: "email_unverified" });
  });
});
