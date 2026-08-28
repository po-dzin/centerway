import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPaymentInvoiceWithDeps } from "@/lib/paymentStart";
import { catalogOffer, type PayableOffer } from "@/lib/products";

/**
 * What the invoice is built FROM.
 *
 * Until 2026-08-22 this function looked the price up in `PRODUCTS` by code,
 * which silently assumed every sellable thing is written in that file. It now
 * takes the resolved offer, so a course priced in the database is charged its
 * own amount — and the test that would have caught the old failure is the one
 * that watches what reaches WayForPay.
 */
const courseOffer: PayableOffer = {
  code: "course:my-course",
  heading: { uk: "Мій курс — CenterWay", en: "Мій курс — CenterWay" },
  description: { uk: "Про що курс", en: "Про що курс" },
  amount: 790,
  listAmount: 1200,
  currency: "UAH",
  pixelContentName: "Мій курс",
  fulfilment: { kind: "course", courseSlug: "my-course" },
  approvedUrl: "https://www.centerway.net.ua/pay/thanks",
  declinedUrl: "https://www.centerway.net.ua/pay/failed",
};

function stubDeps() {
  const inserted: Array<Record<string, unknown>> = [];
  const fetchFn = vi.fn(async () =>
    new Response(JSON.stringify({ invoiceUrl: "https://secure.wayforpay.com/invoice/x" }), {
      headers: { "Content-Type": "application/json" },
    })
  );
  /**
   * Enough of the client for the analytics path to run rather than fall into
   * its own catch: the CAPI job first ASKS whether one already exists, and a
   * stub that only understands `insert` made that lookup throw, so the job
   * payload was never built and nothing about it could be asserted.
   */
  const db = {
    from(table: string) {
      const rows = {
        insert(row: Record<string, unknown>) {
          inserted.push({ __table: table, ...row });
          const result = { error: null, data: { id: "job-1" } };
          return Object.assign(Promise.resolve(result), {
            select: () => ({ maybeSingle: async () => result }),
          });
        },
        select() {
          return rows;
        },
        contains() {
          return rows;
        },
        eq() {
          return rows;
        },
        limit() {
          return rows;
        },
        order() {
          return rows;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
      return rows;
    },
  } as unknown as Parameters<typeof createPaymentInvoiceWithDeps>[1]["db"];

  return {
    inserted,
    fetchFn,
    deps: {
      db,
      fetchFn: fetchFn as unknown as typeof fetch,
      nowMs: () => Date.parse("2026-08-22T10:00:00Z"),
      randomHex: () => "ab12cd34",
    },
  };
}

function wfpBody(fetchFn: ReturnType<typeof vi.fn>) {
  return JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
}

describe("createPaymentInvoice", () => {
  beforeEach(() => {
    process.env.WFP_MERCHANT_ACCOUNT = "test_merchant";
    process.env.WFP_SECRET_KEY = "test_secret";
    process.env.APP_BASE_URL = "https://www.centerway.net.ua";
    process.env.WFP_MERCHANT_DOMAIN = "www.centerway.net.ua";
  });

  it("charges the amount of the offer it was handed, not a code's constant", async () => {
    const { deps, fetchFn, inserted } = stubDeps();

    const result = await createPaymentInvoiceWithDeps(
      { offer: courseOffer, locale: "uk", source: "pay_start", staff: true },
      deps
    );

    expect(result.ok).toBe(true);
    const body = wfpBody(fetchFn);
    expect(body.amount).toBe(790);
    expect(body.productPrice).toEqual([790]);
    expect(body.currency).toBe("UAH");
    expect(inserted[0].product_code).toBe("course:my-course");
    expect(inserted[0].amount).toBe(790);
  });

  it("reports the offer's agreed label to Meta, not the invoice heading", async () => {
    const { deps, inserted } = stubDeps();

    await createPaymentInvoiceWithDeps(
      { offer: courseOffer, locale: "uk", source: "pay_start" },
      deps
    );

    const capiJob = inserted.find((row) => row.__table === "jobs");
    const payload = capiJob?.payload as Record<string, unknown>;
    expect(payload.event_name).toBe("InitiateCheckout");
    // The label is agreed once and kept verbatim, so one product is one name in
    // Meta. The heading is per-locale prose and would have split the report in
    // two the first time somebody bought in English.
    expect(payload.content_name).toBe("Мій курс");
    expect(payload.content_name).not.toBe(courseOffer.heading.uk);
    expect(payload.content_ids).toEqual(["course:my-course"]);
  });

  it("marks a staff checkout so the webhook can keep it out of Meta", async () => {
    const { deps, inserted } = stubDeps();

    await createPaymentInvoiceWithDeps(
      { offer: courseOffer, locale: "uk", source: "pay_start", staff: true },
      deps
    );

    // The browser flag cannot reach the WayForPay callback, so the order carries
    // the mark instead.
    expect(inserted.some((row) => row.type === "staff_checkout")).toBe(true);
    expect(inserted.some((row) => row.__table === "jobs")).toBe(false);
  });

  it("keeps the colon out of the order reference, and the product out of the guesswork", async () => {
    const { deps, fetchFn } = stubDeps();

    const result = await createPaymentInvoiceWithDeps(
      { offer: courseOffer, locale: "uk", source: "pay_start", staff: true },
      deps
    );

    expect(result.ok && result.order_ref).toBe("course-my-course_20260822_ab12cd34");
    // The product still travels — in the return URL, explicitly, because the
    // reference alone cannot be split back into a slug.
    const returnUrl = new URL(wfpBody(fetchFn).returnUrl);
    expect(returnUrl.pathname).toBe("/pay/return");
    expect(returnUrl.searchParams.get("product")).toBe("course:my-course");
  });

  it("still builds the six the way it always did", async () => {
    const { deps, fetchFn, inserted } = stubDeps();

    await createPaymentInvoiceWithDeps(
      { offer: catalogOffer("reset-day"), locale: "uk", source: "pay_start", staff: true },
      deps
    );

    expect(inserted[0].product_code).toBe("reset-day");
    expect(wfpBody(fetchFn).orderReference).toBe("reset-day_20260822_ab12cd34");
  });
});
