import { describe, expect, it } from "vitest";

import { buildReturnDestination, resolveReturnStatus } from "@/lib/payReturn";
import { PLATFORM_FAILED_URL, PLATFORM_PENDING_URL, PLATFORM_THANKS_URL } from "@/lib/products";

/**
 * THE SENTENCE THIS FILE EXISTS TO PREVENT.
 *
 * `/pay/failed` tells the buyer, in so many words, that the money was not
 * taken. The return handler used to poll the order for 1.4 seconds and then
 * route there — so on any callback slower than that, a person whose card had
 * just been charged read that it had not been. The likely next act is paying a
 * second time.
 *
 * "Not confirmed yet" and "declined" are different states. Only WayForPay can
 * tell them apart, and until it does, the answer is `pending`.
 */
describe("resolveReturnStatus", () => {
  const nothingKnown = { fromParams: null, orderStatus: null, lastCallbackStatus: null } as const;

  it("says pending when nothing has come back yet, instead of calling it a failure", () => {
    expect(resolveReturnStatus(nothingKnown)).toBe("pending");
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "created" })).toBe("pending");
  });

  it("believes the gateway when it speaks to the browser directly", () => {
    expect(resolveReturnStatus({ ...nothingKnown, fromParams: "paid" })).toBe("paid");
    expect(resolveReturnStatus({ ...nothingKnown, fromParams: "failed" })).toBe("failed");
  });

  it("prefers the gateway's own word over a stale row", () => {
    // The callback may not have been written yet; the return parameter is
    // first-hand and current, and the row will catch up.
    expect(resolveReturnStatus({ fromParams: "paid", orderStatus: "created", lastCallbackStatus: "Declined" })).toBe(
      "paid"
    );
  });

  it("treats a paid order as proof, since only a signed callback writes it", () => {
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "paid" })).toBe("paid");
  });

  it("treats a refunded order as failed, whatever the last callback said", () => {
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "refunded", lastCallbackStatus: "Approved" })).toBe(
      "failed"
    );
  });

  /* The distinction the old code could not make: a callback that ARRIVED and
     declined the payment is a real failure; silence is not. */
  it("calls it failed only once a rejecting callback has actually arrived", () => {
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "created", lastCallbackStatus: "Declined" })).toBe(
      "failed"
    );
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "created", lastCallbackStatus: "Expired" })).toBe(
      "failed"
    );
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "created", lastCallbackStatus: "Refunded" })).toBe(
      "failed"
    );
  });

  it("keeps waiting while the gateway says the payment is still moving", () => {
    for (const inFlight of ["InProcessing", "WaitingAuthComplete", "Pending", "RefundInProcessing"]) {
      expect(resolveReturnStatus({ ...nothingKnown, lastCallbackStatus: inFlight })).toBe("pending");
    }
  });

  it("recovers a payment whose callback landed but whose order write did not", () => {
    expect(resolveReturnStatus({ ...nothingKnown, orderStatus: "created", lastCallbackStatus: "Approved" })).toBe(
      "paid"
    );
  });

  it("stays pending when the order row could not be read at all", () => {
    // A database we could not reach is not a payment that failed.
    expect(resolveReturnStatus(nothingKnown)).toBe("pending");
  });
});

describe("buildReturnDestination", () => {
  it("sends a pending payment to its own page, not to the one that denies the charge", () => {
    const dest = new URL(buildReturnDestination("pending", "short", "short_20260902_ab12", {}, 0));
    expect(dest.origin + dest.pathname).toBe(PLATFORM_PENDING_URL);
    expect(dest.searchParams.get("order_ref")).toBe("short_20260902_ab12");
    expect(dest.searchParams.get("product")).toBe("short");
  });

  it("still routes the two settled states where they always went", () => {
    /* A paid course goes to its own page rather than to a confirmation screen,
       and for `short` that page is /programs/REBOOT — the product row name and
       the program slug stopped agreeing on 2026-08-29. */
    const paid = new URL(buildReturnDestination("paid", "short", "short_20260902_ab12", {}, 0));
    expect(paid.origin).toBe(new URL(PLATFORM_THANKS_URL).origin);
    expect(paid.pathname).toBe("/programs/reboot");

    const failed = new URL(buildReturnDestination("failed", "short", "short_20260902_ab12", {}, 0));
    expect(failed.origin + failed.pathname).toBe(PLATFORM_FAILED_URL);
  });

  it("does not send a pending course to the course page — it is not owned yet", () => {
    const dest = new URL(
      buildReturnDestination("pending", "course:my-course", "course-my-course_20260902_ab12", {}, 0)
    );
    expect(dest.pathname).toBe("/pay/pending");
  });
});
