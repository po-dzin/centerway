/**
 * The browser's way back from the gateway, through the one channel from a code
 * to an offer (2026-09-25).
 *
 * The route used to keep its own table of spellings and fall through to Short
 * Reboot for anything it did not know — a cohort buyer who had just paid for
 * `way21-group` was sent to the wrong program, with the browser Purchase
 * attributed to the wrong product. Now every code, from the return or from the
 * order row, goes through `describeOffer`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));

const { GET } = await import("./route");

function get(query: string) {
  return GET(new NextRequest(`https://www.centerway.net.ua/pay/return?${query}`));
}

beforeEach(() => {
  db.tables = {
    orders: [
      { order_ref: "way21-group_20260925_ab12", product_code: "way21-group", status: "paid" },
      { order_ref: "short_20260301_ab12", product_code: "short", status: "paid" },
    ],
    payments: [],
    experiences: [
      { id: "exp-way21", kind: "course", slug: "way21", title: null },
      { id: "exp-reboot", kind: "mini", slug: "reboot", title: null },
    ],
    lms_courses: [
      { slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" },
      { slug: "short", program_slug: "reboot", experience_id: "exp-reboot", created_at: "2026-01-01" },
    ],
    experience_offers: [
      { id: "o-group", experience_id: "exp-way21", code: "way21-group", active: true, format: "group" },
      { id: "o-short", experience_id: "exp-reboot", code: "course:short", active: true },
    ],
    offer_aliases: [{ code: "short", offer_id: "o-short" }],
  };
  db.failures = {};
});

describe("GET /pay/return", () => {
  it("returns a paid cohort buyer to the program the format belongs to, under the format's own code", async () => {
    const res = await get("order_ref=way21-group_20260925_ab12");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/programs/way21");
    expect(location.searchParams.get("product")).toBe("way21-group");
    expect(location.searchParams.get("order_ref")).toBe("way21-group_20260925_ab12");
  });

  it("reads an old order's spelling through offer_aliases and returns under the offer's code", async () => {
    const res = await get("order_ref=short_20260301_ab12");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/programs/reboot");
    expect(location.searchParams.get("product")).toBe("course:short");
  });

  it("does not invent a product it cannot resolve — no Short Reboot as a last resort", async () => {
    db.tables.orders = [{ order_ref: "mystery_1", product_code: "mystery", status: "paid" }];
    const res = await get("order_ref=mystery_1");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/pay/thanks");
    expect(location.searchParams.has("product")).toBe(false);
  });
});
