/**
 * The browser's way back from WayForPay, for a code the return route did not
 * know until 2026-09-25: a FORMAT of a program. `way21-group` is none of the
 * six catalogue products and not `course:<slug>`, so the route used to fall
 * through to its last resort and send a cohort buyer who had just paid to
 * Short Reboot — with the browser Purchase attributed to the wrong product.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
const describeFormatCode = vi.fn(async (code: unknown) =>
  code === "way21-group" ? { code: "way21-group", programSlug: "way21" } : null,
);

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/experiences/formats", () => ({ describeFormatCode }));

const { GET } = await import("./route");

function get(query: string) {
  return GET(new NextRequest(`https://www.centerway.net.ua/pay/return?${query}`));
}

beforeEach(() => {
  db.tables = {
    orders: [{ order_ref: "way21-group_20260925_ab12", product_code: "way21-group", status: "paid" }],
    payments: [],
  };
  db.failures = {};
  describeFormatCode.mockClear();
});

describe("GET /pay/return for a format", () => {
  it("returns a paid cohort buyer to the program the format belongs to, under the format's own code", async () => {
    const res = await get("order_ref=way21-group_20260925_ab12");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/programs/way21");
    expect(location.searchParams.get("product")).toBe("way21-group");
    expect(location.searchParams.get("order_ref")).toBe("way21-group_20260925_ab12");
  });

  it("does not claim a format it cannot resolve — an unknown code keeps the old last resort", async () => {
    db.tables.orders = [{ order_ref: "mystery_1", product_code: "mystery", status: "paid" }];
    const res = await get("order_ref=mystery_1");
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("product")).toBe("short");
  });
});
