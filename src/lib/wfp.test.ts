import { afterEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import { buildWfpAcceptResponse, computeWfpCallbackSignature, verifyWfpCallbackSignature } from "./wfp";

const SECRET = "test-merchant-secret";

/**
 * A callback shaped like the ones WayForPay actually sends. The formula this
 * locks was replayed against all 758 stored production callbacks before the
 * webhook started enforcing it; these tests keep it from drifting silently.
 */
function callback(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    merchantAccount: "centerway_net_ua",
    orderReference: "course-reset-day_20260828_ab12",
    amount: "795",
    currency: "UAH",
    authCode: "123456",
    cardPan: "44**** ****1234",
    transactionStatus: "Approved",
    reasonCode: "1100",
    ...overrides,
  };
}

function sign(payload: Record<string, string>, secret = SECRET): string {
  return computeWfpCallbackSignature(payload, secret);
}

const originalSecret = process.env.WFP_SECRET_KEY;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.WFP_SECRET_KEY;
  else process.env.WFP_SECRET_KEY = originalSecret;
});

describe("computeWfpCallbackSignature", () => {
  it("signs the eight spec fields joined by semicolons, in order", () => {
    const payload = callback();
    const expected = crypto
      .createHmac("md5", SECRET)
      .update(
        "centerway_net_ua;course-reset-day_20260828_ab12;795;UAH;123456;44**** ****1234;Approved;1100",
        "utf8"
      )
      .digest("hex");

    expect(sign(payload)).toBe(expected);
  });

  it("treats an absent field as an empty segment rather than skipping it", () => {
    const withoutAuthCode = callback();
    delete withoutAuthCode.authCode;

    expect(sign(withoutAuthCode)).toBe(sign(callback({ authCode: "" })));
    expect(sign(withoutAuthCode)).not.toBe(sign(callback()));
  });

  it("ignores fields outside the signed set, so extra payload keys cannot change the signature", () => {
    expect(sign(callback({ email: "buyer@example.com", rrn: "999" }))).toBe(sign(callback()));
  });
});

describe("verifyWfpCallbackSignature", () => {
  it("accepts a callback signed with our merchant secret", () => {
    process.env.WFP_SECRET_KEY = SECRET;
    const payload = callback();

    expect(verifyWfpCallbackSignature({ ...payload, merchantSignature: sign(payload) })).toEqual({
      ok: true,
      present: true,
      reason: "match",
    });
  });

  it("accepts the signature in either case, since the hex digest casing is not agreed", () => {
    process.env.WFP_SECRET_KEY = SECRET;
    const payload = callback();

    expect(
      verifyWfpCallbackSignature({ ...payload, merchantSignature: sign(payload).toUpperCase() }).ok
    ).toBe(true);
  });

  it("refuses a callback signed with somebody else's secret", () => {
    process.env.WFP_SECRET_KEY = SECRET;
    const payload = callback();

    expect(
      verifyWfpCallbackSignature({ ...payload, merchantSignature: sign(payload, "not-our-secret") })
    ).toEqual({ ok: false, present: true, reason: "mismatch" });
  });

  it("refuses a forged amount even when the rest of the callback is untouched", () => {
    process.env.WFP_SECRET_KEY = SECRET;
    const genuine = callback();
    const signature = sign(genuine);

    expect(
      verifyWfpCallbackSignature({ ...genuine, amount: "1", merchantSignature: signature }).ok
    ).toBe(false);
  });

  it("refuses an unsigned callback — the forged-webhook shape", () => {
    process.env.WFP_SECRET_KEY = SECRET;

    expect(verifyWfpCallbackSignature(callback())).toEqual({
      ok: false,
      present: false,
      reason: "missing_signature",
    });
    expect(verifyWfpCallbackSignature({ ...callback(), merchantSignature: "   " }).reason).toBe(
      "missing_signature"
    );
  });

  it("refuses everything when the secret is absent, rather than waving callbacks through", () => {
    delete process.env.WFP_SECRET_KEY;
    const payload = callback();

    expect(verifyWfpCallbackSignature({ ...payload, merchantSignature: sign(payload) })).toEqual({
      ok: false,
      present: false,
      reason: "missing_secret",
    });
  });
});

describe("buildWfpAcceptResponse", () => {
  const OLD = process.env.WFP_SECRET_KEY;
  afterEach(() => {
    if (OLD === undefined) delete process.env.WFP_SECRET_KEY;
    else process.env.WFP_SECRET_KEY = OLD;
  });

  it("signs orderReference;status;time with HMAC-MD5, per WayForPay's spec", () => {
    process.env.WFP_SECRET_KEY = "flk3409refn54t54t*FNJRET";
    const res = buildWfpAcceptResponse("DH783023", 1415379863);

    // Computed independently of the implementation, from the documented rule:
    // HMAC-MD5 over the three values joined by ";" keyed with the secret.
    const expected = crypto
      .createHmac("md5", "flk3409refn54t54t*FNJRET")
      .update("DH783023;accept;1415379863", "utf8")
      .digest("hex");

    expect(res).toEqual({
      orderReference: "DH783023",
      status: "accept",
      time: 1415379863,
      signature: expected,
    });
  });

  it("refuses to invent an unsigned acceptance when the secret is absent", () => {
    delete process.env.WFP_SECRET_KEY;
    expect(buildWfpAcceptResponse("DH783023", 1415379863)).toBeNull();
  });

  it("signs the time it was given, so the signature and the field cannot disagree", () => {
    process.env.WFP_SECRET_KEY = "secret";
    const a = buildWfpAcceptResponse("ref-1", 1000);
    const b = buildWfpAcceptResponse("ref-1", 2000);
    expect(a?.time).toBe(1000);
    expect(b?.time).toBe(2000);
    expect(a?.signature).not.toBe(b?.signature);
  });
});
