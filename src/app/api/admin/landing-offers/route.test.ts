import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/admin/fakeSupabase";
const state = vi.hoisted(() => ({ role: "admin" as string | null }));
const db = new FakeSupabase();
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: async () => (state.role ? { role: state.role, user: { id: "operator" } } : null),
}));
vi.mock("@/lib/platform/offers", () => ({
  loadPayableOffer: async (code: string) => (code === "course:demo" ? { code, amount: 2000, currency: "UAH" } : null),
}));
const { POST } = await import("./route");
const body = {
  product: "course:demo",
  courseSlug: "demo",
  programSlug: "public-demo",
  discountPercent: 20,
  recipient_key: "email:person@example.com",
};
const post = (over: Record<string, unknown> = {}) =>
  POST(
    new NextRequest("https://www.centerway.net.ua/api/admin/landing-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...over }),
    }),
  );
beforeEach(() => {
  state.role = "admin";
  db.tables = {
    lms_courses: [{ slug: "demo", program_slug: "public-demo", experience_id: "exp-demo" }],
    experience_offers: [
      { code: "course:demo", experience_id: "exp-demo", format: "self", active: true, review_status: "approved" },
    ],
    personal_offer_tokens: [],
    audit_log: [],
  };
  db.failures = {};
});
describe("POST /api/admin/landing-offers percentage issuance", () => {
  it.each([
    [null, 401],
    ["support", 403],
  ] as const)("refuses %s before writing", async (role, status) => {
    state.role = role;
    expect((await post()).status).toBe(status);
    expect(db.rows("personal_offer_tokens")).toHaveLength(0);
  });
  it("issues a draft snapshot, public program link, and audit entry", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.offers[0]).toMatchObject({ amount: 1600, oldAmount: 2000, status: "draft" });
    expect(new URL(result.offers[0].landingUrl).pathname).toBe("/go/public-demo");
    expect(db.rows("personal_offer_tokens")[0]).toMatchObject({ product_code: "course:demo", amount: 1600 });
    expect(db.rows("audit_log")).toHaveLength(1);
  });
  it.each([
    { discountPercent: 0 },
    { discountPercent: 100 },
    { discountPercent: 2.5 },
    { programSlug: "other-program" },
    { courseSlug: "other-course" },
    { product: "other-offer" },
  ])("refuses invalid program/offer/discount without issuing: %j", async (over) => {
    expect((await post(over)).status).toBe(400);
    expect(db.rows("personal_offer_tokens")).toHaveLength(0);
  });
  it.each([{ active: false }, { review_status: "proposed" }, { experience_id: "other" }])(
    "refuses non-saleable or unrelated formats: %j",
    async (over) => {
      Object.assign(db.rows("experience_offers")[0]!, over);
      expect((await post()).status).toBe(400);
      expect(db.rows("personal_offer_tokens")).toHaveLength(0);
    },
  );
});
