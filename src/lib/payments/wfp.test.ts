import { afterEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  buildWfpAcceptResponse,
  computeWfpCallbackSignature,
  nextOrderStatus,
  orderStatusForOutcome,
  statusesProtectedFrom,
  verifyWfpCallbackSignature,
  wfpCallbackOutcome,
  wfpEventTypeFromStatus,
} from "./wfp";

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

describe("wfpCallbackOutcome", () => {
  it("reads WayForPay's own vocabulary, case-insensitively", () => {
    expect(wfpCallbackOutcome(callback({ transactionStatus: "Approved" }))).toBe("approved");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "approved" }))).toBe("approved");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "Declined" }))).toBe("rejected");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "Expired" }))).toBe("rejected");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "Refunded" }))).toBe("refunded");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "Voided" }))).toBe("refunded");
  });

  it("calls a payment still in motion `pending`, so it is never written down as a verdict", () => {
    expect(wfpCallbackOutcome(callback({ transactionStatus: "InProcessing" }))).toBe("pending");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "WaitingAuthComplete" }))).toBe("pending");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "RefundInProcessing" }))).toBe("pending");
    expect(wfpCallbackOutcome(callback({ transactionStatus: "" }))).toBe("pending");
  });

  it("keeps `payment_paid` / `payment_failed` meaning what they meant before", () => {
    expect(wfpEventTypeFromStatus(callback({ transactionStatus: "Approved" }))).toBe("payment_paid");
    expect(wfpEventTypeFromStatus(callback({ transactionStatus: "Declined" }))).toBe("payment_failed");
    expect(wfpEventTypeFromStatus(callback({ transactionStatus: "Refunded" }))).toBe("payment_failed");
    expect(wfpEventTypeFromStatus(callback({ transactionStatus: "InProcessing" }))).toBeNull();
  });
});

describe("nextOrderStatus", () => {
  /* THE REGRESSION THIS FILE EXISTS FOR. WayForPay redelivers callbacks for up
     to four days in no guaranteed order, and four production orders carry both
     a Declined and an Approved callback on one reference. The old webhook wrote
     `paid ? "paid" : "created"` unconditionally, so whichever arrived last won
     — and when that was the decline, a paying customer lost their course. */
  it("REFUSES to take a paid order backwards on a late rejection", () => {
    expect(nextOrderStatus("paid", "rejected")).toBeNull();
  });

  it("still records a rejection for an order that was never paid", () => {
    expect(nextOrderStatus("created", "rejected")).toBe("created");
    expect(nextOrderStatus(null, "rejected")).toBe("created");
  });

  it("lets an approval through from any pre-payment state, and repeats harmlessly", () => {
    expect(nextOrderStatus("created", "approved")).toBe("paid");
    expect(nextOrderStatus(null, "approved")).toBe("paid");
    expect(nextOrderStatus("paid", "approved")).toBe("paid");
  });

  it("treats a refund as the one thing that may take access away", () => {
    expect(nextOrderStatus("paid", "refunded")).toBe("refunded");
    expect(nextOrderStatus("created", "refunded")).toBe("refunded");
  });

  it("makes a refund final for that order reference — a repeat purchase gets a new one", () => {
    expect(nextOrderStatus("refunded", "approved")).toBeNull();
    expect(nextOrderStatus("refunded", "rejected")).toBeNull();
  });

  it("writes nothing at all while the payment is still in motion", () => {
    for (const held of [null, "created", "paid", "refunded"]) {
      expect(nextOrderStatus(held, "pending")).toBeNull();
    }
  });

  it("does not mistake an unrecognised stored status for an empty one", () => {
    // Free text column: a value we do not know is not a value we may overwrite
    // blindly, but it is also not `paid`, so a rejection may still land.
    expect(nextOrderStatus("completed", "approved")).toBe("paid");
    expect(nextOrderStatus("PAID", "rejected")).toBeNull();
    expect(nextOrderStatus("  paid  ", "rejected")).toBeNull();
  });
});

describe("statusesProtectedFrom", () => {
  /* The webhook repeats this guard as a SQL predicate so that two callbacks in
     flight at once cannot both act on a value read a moment earlier. That only
     holds while the predicate and the decision agree, so assert the agreement
     rather than trusting two lists to be maintained together. */
  it("agrees with nextOrderStatus for every state a row can hold", () => {
    const outcomes = ["approved", "refunded", "rejected", "pending"] as const;
    const held = ["created", "paid", "refunded"] as const;

    for (const outcome of outcomes) {
      for (const current of held) {
        const blockedBySql = statusesProtectedFrom(outcome).includes(current);
        const blockedInJs = nextOrderStatus(current, outcome) === null;
        // `pending` writes nothing for a reason the predicate cannot express:
        // there is no target status at all, so the route never issues a write.
        if (outcome === "pending") {
          expect(blockedInJs).toBe(true);
          continue;
        }
        expect(blockedBySql).toBe(blockedInJs);
      }
    }
  });

  it("names the target status for every outcome that writes one", () => {
    expect(orderStatusForOutcome("approved")).toBe("paid");
    expect(orderStatusForOutcome("refunded")).toBe("refunded");
    expect(orderStatusForOutcome("rejected")).toBe("created");
    expect(orderStatusForOutcome("pending")).toBeNull();
  });
});
