import { strict as assert } from "node:assert";
import { resolveCheckoutProduct } from "../src/lib/checkout";
import { hostBrandFromHost } from "../src/lib/hostBrand";
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

  // Host -> brand mapping
  assert.equal(hostBrandFromHost("reboot.centerway.net.ua"), "short");
  assert.equal(hostBrandFromHost("irem.centerway.net.ua"), "irem");
  assert.equal(hostBrandFromHost("localhost:3000"), "short");
  assert.equal(hostBrandFromHost("centerway.net.ua"), null);

  // Checkout product resolver
  assert.equal(resolveCheckoutProduct({ site: "irem" }), "irem");
  assert.equal(resolveCheckoutProduct({ offer_id: "irem_main_4100" }), "irem");
  assert.equal(resolveCheckoutProduct({ offer_id: "short_reboot_359" }), "short");
  assert.equal(resolveCheckoutProduct({}), "short");

  console.log("smoke: ok");
}

run();
