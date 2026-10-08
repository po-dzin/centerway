import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "crypto";

import {
  buildLiqpaySplitRules,
  decodeLiqpayData,
  encodeLiqpayData,
  liqpay,
  liqpayOutcome,
  liqpaySignature,
  verifyLiqpayCallbackSignature,
} from "./liqpay";

const PUBLIC = "i000000000";
const PRIVATE = "liqpay-test-private";
const PLATFORM_RECEIVER = "i999999999";

const ENV = ["LIQPAY_PUBLIC_KEY", "LIQPAY_PRIVATE_KEY", "LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY"] as const;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

beforeEach(() => {
  process.env.LIQPAY_PUBLIC_KEY = PUBLIC;
  process.env.LIQPAY_PRIVATE_KEY = PRIVATE;
  delete process.env.LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY;
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** A callback as LiqPay posts it: the fields inside `data`, signed with our key. */
function signedCallback(fields: Record<string, unknown>, privateKey = PRIVATE): Record<string, string> {
  const data = encodeLiqpayData(fields);
  return { data, signature: liqpaySignature(data, privateKey) };
}

const PAID = {
  order_id: "way21_20261003_ab12",
  status: "success",
  amount: 4100,
  currency: "UAH",
  payment_id: 2_000_000_001,
  end_date: 1_760_000_000_000,
  sender_phone: "380501112233",
};

describe("liqpaySignature", () => {
  it("is base64(sha1(private + data + private))", () => {
    const data = encodeLiqpayData({ a: 1 });
    const expected = crypto
      .createHash("sha1")
      .update(PRIVATE + data + PRIVATE)
      .digest("base64");
    expect(liqpaySignature(data, PRIVATE)).toBe(expected);
  });
});

describe("verifyLiqpayCallbackSignature", () => {
  it("accepts a callback signed with our private key", () => {
    expect(verifyLiqpayCallbackSignature(signedCallback(PAID))).toEqual({ ok: true, present: true, reason: "match" });
  });

  it("refuses one signed with another key, and one with its data changed after signing", () => {
    expect(verifyLiqpayCallbackSignature(signedCallback(PAID, "someone-else")).reason).toBe("mismatch");
    const forged = signedCallback(PAID);
    forged.data = encodeLiqpayData({ ...PAID, amount: 1 });
    expect(verifyLiqpayCallbackSignature(forged).ok).toBe(false);
  });

  it("refuses when the key is not configured, rather than accepting what it cannot check", () => {
    delete process.env.LIQPAY_PRIVATE_KEY;
    expect(verifyLiqpayCallbackSignature(signedCallback(PAID)).reason).toBe("missing_secret");
  });
});

describe("liqpayOutcome", () => {
  it("opens access only on success", () => {
    expect(liqpayOutcome("success")).toBe("approved");
    expect(liqpayOutcome("reversed")).toBe("refunded");
    expect(liqpayOutcome("failure")).toBe("rejected");
    expect(liqpayOutcome("error")).toBe("rejected");
  });

  it("keeps a test-mode payment and an unactivated shop's payment pending", () => {
    expect(liqpayOutcome("sandbox")).toBe("pending");
    expect(liqpayOutcome("wait_accept")).toBe("pending");
    expect(liqpayOutcome("3ds_verify")).toBe("pending");
    expect(liqpayOutcome(null)).toBe("pending");
  });
});

describe("liqpay.readCallback", () => {
  it("decodes the envelope into our words, and stores the decoded fields", () => {
    const read = liqpay.readCallback(signedCallback({ ...PAID, sender_email: "Buyer@Example.com" }))!;
    expect(read).toMatchObject({
      orderRef: PAID.order_id,
      outcome: "approved",
      rawStatus: "success",
      providerTxId: "2000000001",
      occurredAt: 1_760_000_000,
      amount: 4100,
      currency: "UAH",
      payer: { email: "Buyer@Example.com", phone: "380501112233" },
    });
    expect(read.raw.status).toBe("success");
    expect(read.raw.data).toBeUndefined();
    expect(liqpay.storedOutcome(read.raw)).toBe("approved");
  });

  it("names no order when the data is not LiqPay's", () => {
    expect(liqpay.readCallback({ data: "not-base64-json", signature: "x" })).toBeNull();
    expect(liqpay.readCallback(signedCallback({ status: "success" }))).toBeNull();
    expect(decodeLiqpayData(Buffer.from("[1]").toString("base64"))).toBeNull();
  });
});

describe("liqpay.createInvoice", () => {
  const request = {
    orderRef: "way21_20261003_ab12",
    orderDate: 1_760_000_000,
    amount: 4100,
    currency: "UAH",
    lineTitle: "Шлях 21 —\n CenterWay",
    returnUrl: "https://www.centerway.net.ua/pay/return?order_ref=x",
    callbackUrl: "https://www.centerway.net.ua/api/liqpay/webhook",
  };

  function decodedFrom(payUrl: string) {
    const url = new URL(payUrl);
    const data = url.searchParams.get("data")!;
    expect(url.origin + url.pathname).toBe("https://www.liqpay.ua/api/3/checkout");
    expect(url.searchParams.get("signature")).toBe(liqpaySignature(data, PRIVATE));
    return decodeLiqpayData(data)!;
  }

  it("is a signed checkout link carrying the order, both addresses and no split", async () => {
    const result = await liqpay.createInvoice(request, fetch);
    expect(result.ok).toBe(true);
    const params = decodedFrom((result as { payUrl: string }).payUrl);
    expect(params).toMatchObject({
      version: 3,
      public_key: PUBLIC,
      action: "pay",
      amount: 4100,
      currency: "UAH",
      description: "Шлях 21 — CenterWay",
      order_id: request.orderRef,
      result_url: request.returnUrl,
      server_url: request.callbackUrl,
    });
    expect(params.split_rules).toBeUndefined();
  });

  it("cannot split without a shop for the platform's own part", async () => {
    expect(liqpay.supportsSplit).toBe(false);
    const splits = [{ receiverRef: "i111", amount: 2460, description: "a" }];
    expect(await liqpay.createInvoice({ ...request, splits }, fetch)).toEqual({
      ok: false,
      error: "gateway_split_unsupported",
    });
  });

  it("routes the author's part to the author and the rest to the platform's shop", async () => {
    process.env.LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY = PLATFORM_RECEIVER;
    expect(liqpay.supportsSplit).toBe(true);
    const splits = [{ receiverRef: "i111", amount: 2460, description: "Шлях 21: частка автора" }];
    const result = await liqpay.createInvoice({ ...request, splits }, fetch);
    const params = decodedFrom((result as { payUrl: string }).payUrl);
    expect(JSON.parse(params.split_rules as string)).toEqual([
      { public_key: "i111", amount: 2460, commission_payer: "receiver", description: "Шлях 21: частка автора" },
      { public_key: PLATFORM_RECEIVER, amount: 1640, commission_payer: "receiver", description: "CenterWay" },
    ]);
  });
});

describe("buildLiqpaySplitRules", () => {
  it("adds up to the payment to the kopeck", () => {
    const rules = buildLiqpaySplitRules([{ receiverRef: "a", amount: 333.33, description: "a" }], 999.99, "p", "p")!;
    expect(rules.map((r) => r.amount)).toEqual([333.33, 666.66]);
  });

  it("refuses parts that leave the platform nothing, or nothing to the author", () => {
    expect(buildLiqpaySplitRules([{ receiverRef: "a", amount: 100, description: "a" }], 100, "p", "p")).toBeNull();
    expect(buildLiqpaySplitRules([{ receiverRef: "a", amount: 0, description: "a" }], 100, "p", "p")).toBeNull();
  });
});

describe("liqpay.acknowledge", () => {
  it("is a plain 200: LiqPay reads the status, not a signed body", () => {
    expect(liqpay.acknowledge("x")).toEqual({ status: 200, body: { ok: true } });
  });
});
