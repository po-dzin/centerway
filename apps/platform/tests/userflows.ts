import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { buildLeadRecord, persistLeadBestEffort } from "../src/lib/checkoutFlow";
import { resolveCheckoutProduct } from "../src/lib/checkout";
import { buildReturnDestination } from "../src/lib/payReturn";
import { extractPaymentMeta } from "../src/lib/paymentMeta";
import { isWfpApproved, wfpEventTypeFromStatus } from "../src/lib/wfp";
import { createPaymentInvoiceWithDeps } from "../src/lib/paymentStart";

type Row = Record<string, unknown>;

function readLocal(relativePath: string): string {
  const full = path.join(process.cwd(), relativePath);
  return fs.readFileSync(full, "utf8");
}

function makeInsertDb(failTable?: string) {
  const writes: Array<{ table: string; row: Row }> = [];
  const db = {
    writes,
    from(table: string) {
      return {
        insert: async (row: Row) => {
          writes.push({ table, row });
          if (table === failTable) return { error: { message: `${table}_failed` } };
          return { error: null };
        },
      };
    },
  };
  return db;
}

async function withPaymentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = {
    WFP_MERCHANT_ACCOUNT: process.env.WFP_MERCHANT_ACCOUNT,
    WFP_SECRET_KEY: process.env.WFP_SECRET_KEY,
    APP_BASE_URL: process.env.APP_BASE_URL,
    WFP_MERCHANT_DOMAIN: process.env.WFP_MERCHANT_DOMAIN,
  };
  process.env.WFP_MERCHANT_ACCOUNT = "merchant";
  process.env.WFP_SECRET_KEY = "secret";
  process.env.APP_BASE_URL = "https://platform.centerway.net.ua";
  process.env.WFP_MERCHANT_DOMAIN = "platform.centerway.net.ua";
  try {
    return await fn();
  } finally {
    process.env.WFP_MERCHANT_ACCOUNT = prev.WFP_MERCHANT_ACCOUNT;
    process.env.WFP_SECRET_KEY = prev.WFP_SECRET_KEY;
    process.env.APP_BASE_URL = prev.APP_BASE_URL;
    process.env.WFP_MERCHANT_DOMAIN = prev.WFP_MERCHANT_DOMAIN;
  }
}

function assertLandingEntryAndView() {
  const shortIndex = readLocal("public/legacy/short/index.html");
  const iremIndex = readLocal("public/legacy/irem/index.html");

  assert.match(shortIndex, /class="openModal"/, "short landing must have CTA openModal");
  assert.match(iremIndex, /class="openModal"/, "irem landing must have CTA openModal");
  assert.match(iremIndex, /id="precheckoutModal"/, "irem must have precheckout modal");
  assert.match(iremIndex, /id="precheckoutForm"/, "irem must have precheckout form");
  assert.match(iremIndex, /id="precheckoutEmail"/, "irem must have email input");
  assert.match(iremIndex, /id="precheckoutPhone"/, "irem must have phone input");
}

function assertCheckoutClientFlow() {
  const shortJs = readLocal("public/legacy/short/js/common.js");
  const iremJs = readLocal("public/legacy/irem/js/common.js");

  assert.match(shortJs, /\/api\/pay\/start\?product=/, "short CTA must open /api/pay/start");
  assert.match(shortJs, /PRODUCT_CODE = "short"/, "short flow must use short product");

  assert.match(iremJs, /CHECKOUT_ENDPOINT = API_BASE \+ "\/api\/checkout\/start"/, "irem must call /api/checkout/start");
  assert.match(iremJs, /trackInitialCheckout\(\)/, "irem must track initial checkout when opening precheckout form");
  assert.match(iremJs, /event\.target\.closest\("\.openModal"\)[\s\S]*trackInitialCheckout\(\)[\s\S]*openModal\(trigger\)/, "initial checkout event must be on the button that opens the form");
  assert.match(iremJs, /email:/, "irem request payload must include email");
  assert.match(iremJs, /phone:/, "irem request payload must include phone");
  assert.match(iremJs, /utm_source:/, "irem request payload must include attribution");
  assert.match(iremJs, /window\.location\.href = data\.paymentUrl/, "irem must redirect to WFP URL");
  assert.equal((iremJs.match(/InitiateCheckout/g) || []).length, 1, "irem should emit a single InitiateCheckout trigger path (on modal open)");
}

async function assertCheckoutAndLeadsPersistence() {
  const body = {
    site: "irem",
    offer_id: "irem_main_4100",
    email: "Test@Example.com",
    phone: "+380991112233",
    event_id: "evt-1",
    value: 4100,
    currency: "uah",
    utm_source: "meta",
  };

  const lead = buildLeadRecord(body, "irem", "irem_20260213_deadbeef", "irem.centerway.net.ua");
  assert.equal(lead.email, "test@example.com");
  assert.equal(lead.currency, "UAH");
  assert.equal(lead.product_code, "irem");

  const leadDb = makeInsertDb();
  const leadSaved = await persistLeadBestEffort(leadDb as any, lead);
  assert.equal(leadSaved, "leads");
  assert.equal(leadDb.writes[0].table, "leads");

  const fallbackDb = makeInsertDb("leads");
  const fallbackSaved = await persistLeadBestEffort(fallbackDb as any, lead);
  assert.equal(fallbackSaved, "events_fallback");
  assert.equal(fallbackDb.writes[0].table, "leads");
  assert.equal(fallbackDb.writes[1].table, "events");
}

async function assertPaymentStartAndWfpOpen() {
  await withPaymentEnv(async () => {
    const db = makeInsertDb();
    const calls: Array<{ url: string; body: string }> = [];

    const result = await createPaymentInvoiceWithDeps(
      {
        product: "short",
        locale: "ua",
        source: "pay_start",
        host: "reboot.centerway.net.ua",
        payload: { stage: "test" },
      },
      {
        db: db as any,
        nowMs: () => Date.UTC(2026, 1, 13, 10, 0, 0),
        randomHex: () => "abcd1234",
        fetchFn: (async (url: string, init?: RequestInit) => {
          calls.push({ url, body: String(init?.body ?? "") });
          return new Response(JSON.stringify({ invoiceUrl: "https://secure.wayforpay.com/invoice/test" }), { status: 200 });
        }) as typeof fetch,
      }
    );

    assert.equal(result.ok, true, "payment start must succeed");
    if (result.ok) {
      assert.equal(result.product, "short");
      assert.equal(result.order_ref, "short_20260213_abcd1234");
      assert.equal(result.payUrl, "https://secure.wayforpay.com/invoice/test");
    }
    assert.equal(calls.length, 1, "WFP create invoice call must be sent once");
    assert.equal(calls[0].url, "https://api.wayforpay.com/api");
    assert.ok(calls[0].body.includes("CREATE_INVOICE"));
    assert.equal(db.writes[0].table, "orders");
    assert.equal(db.writes[1].table, "events");
  });
}

function assertWfpVerificationAndCustomerIntent() {
  const payload = {
    orderReference: "irem_20260213_deadbeef",
    transactionStatus: "APPROVED",
    rrn: "123456789",
    amount: "4100",
    currency: "UAH",
    email: "test@example.com",
    phone: "+380991112233",
  };

  const meta = extractPaymentMeta(payload);
  assert.equal(meta.rrn, "123456789");
  assert.equal(meta.email, "test@example.com");
  assert.equal(meta.phone, "+380991112233");
  assert.equal(isWfpApproved(payload), true);
  assert.equal(wfpEventTypeFromStatus(payload), "payment_paid");
}

function assertReturnAndPostPaymentPages() {
  const paid = buildReturnDestination(
    "paid",
    "short",
    "short_20260213_deadbeef",
    { rrn: "111", amount: "359", currency: "UAH" },
    123
  );
  const failed = buildReturnDestination(
    "failed",
    "irem",
    "irem_20260213_deadbeef",
    { rrn: "222", amount: "4100", currency: "UAH" },
    456
  );
  assert.match(paid, /reboot\.centerway\.net\.ua\/thanks/, "paid short must route to short thanks");
  assert.match(failed, /irem\.centerway\.net\.ua\/pay-failed/, "failed irem must route to irem failed");

  const shortThanks = readLocal("public/legacy/short/thanks.html");
  const iremThanks = readLocal("public/legacy/irem/thanks.html");
  const shortFailed = readLocal("public/legacy/short/pay-failed.html");
  const iremFailed = readLocal("public/legacy/irem/pay-failed.html");

  assert.match(shortThanks, /ShortRebootBot/, "short thanks must include bot link");
  assert.match(iremThanks, /IREM_gymnastic_Bot/, "irem thanks must include bot link");
  assert.match(shortThanks, /Повернутися на сайт/, "short thanks must keep manual home button");
  assert.match(iremThanks, /Повернутися на сайт/, "irem thanks must keep manual home button");
  assert.match(shortFailed, /Спробувати ще раз/, "short failed must keep retry button");
  assert.match(iremFailed, /Спробувати ще раз/, "irem failed must keep retry button");
}

function assertNoCrossDomainLeak() {
  const shortOffer = readLocal("public/legacy/short/public-offer.html");
  const iremOffer = readLocal("public/legacy/irem/public-offer.html");
  assert.doesNotMatch(shortOffer, /href="https?:\/\/centerway\.net\.ua"/);
  assert.doesNotMatch(iremOffer, /href="https?:\/\/centerway\.net\.ua"/);
  assert.doesNotMatch(shortOffer, /href="\/"/);
  assert.doesNotMatch(iremOffer, /href="\/"/);
  assert.match(shortOffer, /https:\/\/centerway\.net\.ua/);
  assert.match(iremOffer, /https:\/\/centerway\.net\.ua/);
}

function assertFlowDecisionClarity() {
  // Deterministic product selection for checkout endpoint.
  assert.equal(resolveCheckoutProduct({ site: "irem" }), "irem");
  assert.equal(resolveCheckoutProduct({ site: "short" }), "short");
  assert.equal(resolveCheckoutProduct({ offer_id: "irem_main_4100" }), "irem");
  assert.equal(resolveCheckoutProduct({ offer_id: "short_reboot_359" }), "short");
  assert.equal(resolveCheckoutProduct({}), "short");
}

async function run() {
  assertLandingEntryAndView();
  assertCheckoutClientFlow();
  await assertCheckoutAndLeadsPersistence();
  await assertPaymentStartAndWfpOpen();
  assertWfpVerificationAndCustomerIntent();
  assertReturnAndPostPaymentPages();
  assertNoCrossDomainLeak();
  assertFlowDecisionClarity();
  console.log("userflows: ok");
}

run();
