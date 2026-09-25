import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

import { experiencesOpenedBy, isPayable, listOffersOf, resolveOffer } from "./offers";

const db = new FakeSupabase();

const offer = (overrides: Partial<Row>): Row => ({
  id: "offer-way21",
  experience_id: "exp-way21",
  code: "course:way21",
  mode: "checkout",
  amount: 4100,
  list_amount: null,
  currency: "UAH",
  access_days: null,
  access_lifetime: true,
  invoice_heading: { uk: "Шлях 21 — інтегративна детокс-програма", en: "Way 21 — integrative detox program" },
  invoice_description: null,
  share_pct: null,
  pixel_content_name: "Way21 Detox",
  active: true,
  ...overrides,
});

beforeEach(() => {
  db.tables = {
    experience_offers: [
      offer({}),
      offer({ id: "offer-support", code: "way21-support", experience_id: "exp-support", mode: "lead", amount: 9000 }),
      offer({ id: "offer-early", code: "course:way21-early", amount: 3100, list_amount: 4100 }),
      offer({ id: "offer-consult", code: "consult", experience_id: "exp-consult", mode: "lead", amount: null }),
      offer({ id: "offer-old", code: "course:way21-2025", amount: 2500, active: false }),
    ],
    offer_aliases: [
      { code: "shlyah21", offer_id: "offer-way21" },
      { code: "way21_support", offer_id: "offer-support" },
    ],
    experience_offer_items: [{ offer_id: "offer-support", experience_id: "exp-way21" }],
  };
  db.failures = {};
});

describe("resolveOffer", () => {
  it("finds an offer by its live code, in any case", async () => {
    expect(await resolveOffer(db as never, "Course:Way21")).toMatchObject({
      via: "code",
      offer: { id: "offer-way21" },
    });
  });

  it("finds it by a code it used to be sold under", async () => {
    expect(await resolveOffer(db as never, "shlyah21")).toMatchObject({
      via: "alias",
      offer: { code: "course:way21" },
    });
  });

  it("still explains a withdrawn offer — an old order was real when it was placed", async () => {
    const found = await resolveOffer(db as never, "course:way21-2025");
    expect(found?.offer.active).toBe(false);
    expect(found && isPayable(found.offer)).toBe(false);
  });

  it("answers null for a code nobody holds, and for something that is not a code", async () => {
    expect(await resolveOffer(db as never, "course:nope")).toBeNull();
    expect(await resolveOffer(db as never, 7)).toBeNull();
  });

  it("fills the second language from the first when the author wrote one", async () => {
    db.tables.experience_offers![0]!.invoice_heading = { uk: "Шлях 21" };
    expect((await resolveOffer(db as never, "course:way21"))?.offer.invoiceHeading).toEqual({
      uk: "Шлях 21",
      en: "Шлях 21",
    });
  });
});

describe("listOffersOf", () => {
  it("gives one thing several offers, cheapest first, without the withdrawn one", async () => {
    expect((await listOffersOf(db as never, "exp-way21")).map((one) => one.code)).toEqual([
      "course:way21-early",
      "course:way21",
    ]);
  });
});

describe("experiencesOpenedBy", () => {
  it("lets the guided package into the course it contains", async () => {
    expect(await experiencesOpenedBy(db as never, { id: "offer-support", experienceId: "exp-support" })).toEqual([
      "exp-support",
      "exp-way21",
    ]);
  });

  it("opens only its own thing for an ordinary offer", async () => {
    expect(await experiencesOpenedBy(db as never, { id: "offer-way21", experienceId: "exp-way21" })).toEqual([
      "exp-way21",
    ]);
  });
});

describe("isPayable", () => {
  it("opens a checkout only for an active offer with a figure", async () => {
    const payable = async (code: string) => isPayable((await resolveOffer(db as never, code))!.offer);
    expect(await payable("course:way21")).toBe(true);
    expect(await payable("way21-support")).toBe(false); // a lead with a quoted price is still a lead
    expect(await payable("consult")).toBe(false);
  });
});
