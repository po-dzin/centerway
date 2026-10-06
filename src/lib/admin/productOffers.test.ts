/**
 * The owner's prices for products with no course of their own.
 *
 * The rules this locks down are the ones a normal form would get wrong by
 * default: a blank amount is a real state («ціна за запитом»), zero is not
 * one, a struck-through price needs a real price under it, and only the four
 * codes this screen knows about may be priced at all — a row for an unknown
 * code would sit in the admin looking like a live offer that nothing reads.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();

vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: () => db,
}));

const { listProductOffers, saveProductOffer, setProductOfferActive } = await import("./productOffers");

function seed(offers: Row[] = []) {
  // Prices live in the one table since 2026-09-25; a product's row hangs off
  // its thing in the registry, found by the same slug as the code.
  db.tables = {
    experience_offers: offers,
    experiences: [
      { id: "exp-herbs", slug: "herbs", kind: "physical", title: "Фітозбір" },
      { id: "exp-consult", slug: "consult", kind: "consultation", title: "Консультація" },
      { id: "exp-irem-individual", slug: "irem-individual", kind: "package", title: "IREM — індивідуально" },
      // A course is priced on the catalogue screen, never here.
      { id: "exp-way21", slug: "way21", kind: "course", title: null },
    ],
  };
  db.failures = {};
}

const offerOf = (overrides: Partial<Row> = {}): Row => ({
  code: "herbs",
  amount: 1,
  list_amount: null,
  currency: "UAH",
  mode: "checkout",
  pixel_content_name: "Herbal Blend",
  active: true,
  updated_at: "2026-09-02T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  seed();
});

describe("listProductOffers", () => {
  it("lists every priceable product even when it has no row yet", async () => {
    // The point of the screen: a product with nothing in the table must
    // still appear, or the owner cannot give it its first price.
    const rows = await listProductOffers();
    expect(rows.map((r) => r.code).sort()).toEqual(["consult", "herbs", "irem-individual"]);
    expect(rows.every((r) => r.offer === null)).toBe(true);
  });

  it("attaches the row to the product it prices", async () => {
    seed([offerOf({ code: "herbs", amount: 640 })]);
    const rows = await listProductOffers();
    const herbs = rows.find((r) => r.code === "herbs");
    expect(herbs?.offer?.amount).toBe(640);
  });

  it("lists a package only until its offer becomes a format of another experience", async () => {
    db.tables.experiences!.push({
      id: "exp-way21-support",
      slug: "way21-support",
      title: "Супровід",
      kind: "package",
    });
    expect((await listProductOffers()).some((row) => row.code === "way21-support")).toBe(true);
    db.tables.experience_offers!.push(
      offerOf({ code: "way21-support", experience_id: "exp-way21", format: "individual", amount: 9000 }),
    );
    const rows = await listProductOffers();
    expect(rows.some((row) => row.code === "way21-support")).toBe(false);
    expect(rows.map((row) => row.code).sort()).toEqual(["consult", "herbs", "irem-individual"]);
  });
});

describe("saveProductOffer", () => {
  it("refuses a code this screen does not know about", async () => {
    await expect(
      saveProductOffer({ code: "not-a-product", amount: 100, listAmount: null, kind: "checkout" }),
    ).rejects.toThrow("product_unknown");
  });

  it("accepts null as «ціна за запитом», not as a refusal", async () => {
    const offer = await saveProductOffer({ code: "consult", amount: null, listAmount: null, kind: "lead" });
    expect(offer.amount).toBeNull();
  });

  it("refuses zero — null is the honest way to say there is no price", async () => {
    await expect(saveProductOffer({ code: "herbs", amount: 0, listAmount: null, kind: "checkout" })).rejects.toThrow(
      "product_amount_invalid",
    );
  });

  it("refuses a struck-through price with nothing under it to strike", async () => {
    await expect(saveProductOffer({ code: "herbs", amount: null, listAmount: 999, kind: "checkout" })).rejects.toThrow(
      "product_list_amount_without_amount",
    );
  });

  it("refuses a struck-through price at or below the charged one", async () => {
    await expect(saveProductOffer({ code: "herbs", amount: 500, listAmount: 500, kind: "checkout" })).rejects.toThrow(
      "product_list_amount_invalid",
    );
  });

  it("writes the row and never touches pixel_content_name", async () => {
    seed([offerOf({ code: "herbs", amount: 1, pixel_content_name: "Herbal Blend" })]);
    const offer = await saveProductOffer({ code: "herbs", amount: 850, listAmount: null, kind: "checkout" });
    expect(offer.amount).toBe(850);
    // Meta's reporting history is joined on this field; it is set once at
    // seed time and this call must not be able to rename it.
    expect(offer.pixelContentName).toBe("Herbal Blend");
  });

  it("refuses a checkout price for a package sold as an enquiry only by the caller's own claim, not silently", async () => {
    // The service does not police kind against a fixed answer per product —
    // the admin's <select> does that — but it does insist kind is one of
    // the two real values.
    await expect(
      saveProductOffer({ code: "herbs", amount: 100, listAmount: null, kind: "bogus" as never }),
    ).rejects.toThrow("product_kind_invalid");
  });

  it("excludes a retired package alias and refuses both price and sale writes to its course format", async () => {
    db.tables.experiences!.push({ id: "exp-way21-support", slug: "way21-support", kind: "package", title: "Супровід" });
    db.tables.experience_offers = [
      offerOf({ code: "way21-support", experience_id: "exp-way21", format: "individual", amount: 9000, mode: "lead" }),
    ];
    expect((await listProductOffers()).map((row) => row.code)).not.toContain("way21-support");
    await expect(
      saveProductOffer({ code: "way21-support", amount: 9500, listAmount: null, kind: "lead" }),
    ).rejects.toThrow("product_unknown");
    await expect(setProductOfferActive("way21-support", false)).rejects.toThrow("product_unknown");
    expect(db.tables.experience_offers[0]).toMatchObject({ amount: 9000, active: true, experience_id: "exp-way21" });
  });
  it("also excludes a rebound offer before its format marker is set", async () => {
    db.tables.experience_offers = [offerOf({ code: "herbs", experience_id: "exp-way21", format: null })];
    expect((await listProductOffers()).map((row) => row.code)).not.toContain("herbs");
  });
});

describe("setProductOfferActive", () => {
  it("refuses an unknown code", async () => {
    await expect(setProductOfferActive("not-a-product", false)).rejects.toThrow("product_unknown");
  });

  it("refuses toggling a product that has no row yet", async () => {
    await expect(setProductOfferActive("herbs", false)).rejects.toThrow("product_offer_not_found");
  });

  it("withdraws and resumes an existing row", async () => {
    seed([offerOf({ code: "herbs" })]);
    const withdrawn = await setProductOfferActive("herbs", false);
    expect(withdrawn.active).toBe(false);
    const resumed = await setProductOfferActive("herbs", true);
    expect(resumed.active).toBe(true);
  });
});
