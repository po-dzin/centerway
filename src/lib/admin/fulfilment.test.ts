import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import { setFulfilmentStatus } from "./fulfilment";

const db = new FakeSupabase();

beforeEach(() => {
  db.tables = {
    orders: [
      { order_ref: "consult_1", product_code: "consult", fulfilment_status: "pending" },
      { order_ref: "course_1", product_code: "course:way21", fulfilment_status: null },
    ],
    audit_log: [],
  };
  db.failures = {};
});

const set = (orderRef: string, status: "pending" | "scheduled" | "done" | "cancelled") =>
  setFulfilmentStatus(db as never, { orderRef, status, actorId: "support-1" });

describe("setFulfilmentStatus", () => {
  it("moves a consultation along and says so in the audit", async () => {
    expect(await set("consult_1", "scheduled")).toMatchObject({ previous: "pending", status: "scheduled" });
    expect(db.rows("orders")[0]).toMatchObject({ fulfilment_status: "scheduled" });
    expect(db.rows("audit_log")[0]).toMatchObject({
      action: "order.fulfilment.set",
      entity_id: "consult_1",
      metadata: { previous: "pending", next: "scheduled" },
    });
  });

  it("lets a mistake be corrected — any step to any step", async () => {
    await set("consult_1", "done");
    expect(await set("consult_1", "scheduled")).toMatchObject({ previous: "done", status: "scheduled" });
  });

  it("writes nothing when the state is already the one asked for", async () => {
    await set("consult_1", "pending");
    expect(db.rows("audit_log")).toHaveLength(0);
  });

  it("refuses a course sale: there is nothing for a person to carry out", async () => {
    await expect(set("course_1", "done")).rejects.toMatchObject({
      message: "order_not_fulfilled_by_hand",
      status: 409,
    });
    expect(db.rows("orders")[1]).toMatchObject({ fulfilment_status: null });
  });

  it("answers 404 for an order that does not exist", async () => {
    await expect(set("nope", "done")).rejects.toMatchObject({ status: 404 });
  });
});
