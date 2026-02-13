import { strict as assert } from "node:assert";
import { isWfpApproved, wfpEventTypeFromStatus } from "../src/lib/wfp";

function run() {
  // Approved statuses
  assert.equal(isWfpApproved({ transactionStatus: "APPROVED" }), true);
  assert.equal(wfpEventTypeFromStatus({ status: "paid" }), "payment_paid");

  // Failure statuses
  assert.equal(wfpEventTypeFromStatus({ transactionStatus: "declined" }), "payment_failed");
  assert.equal(wfpEventTypeFromStatus({ transactionStatus: "expired" }), "payment_failed");

  // Pending/created should not emit events
  assert.equal(wfpEventTypeFromStatus({ transactionStatus: "created" }), null);
  assert.equal(wfpEventTypeFromStatus({ transactionStatus: "pending" }), null);

  console.log("smoke: ok");
}

run();
