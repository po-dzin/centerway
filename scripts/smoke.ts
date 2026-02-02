import { strict as assert } from "node:assert";
import { productHeading, productDescription, normalizeLocale } from "../src/lib/products";
import { buildReturnUrl, buildWfpProductName, sanitizeWfpProductName } from "../src/lib/pay";

function run() {
  // Locale normalization
  assert.equal(normalizeLocale("ua"), "ua");
  assert.equal(normalizeLocale("uk-UA"), "ua");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("fr"), null);

  // Titles available and not empty
  const shortUa = productHeading("short", "ua");
  const shortEn = productHeading("short", "en");
  const iremUa = productHeading("irem", "ua");
  const shortDescUa = productDescription("short", "ua");

  assert.ok(shortUa.length > 10);
  assert.ok(shortEn.length > 0);
  assert.ok(iremUa.length > 10);
  assert.ok(shortDescUa.length > 20);

  // WFP product name sanitization (<= 255, no tags)
  const longWithTags = `${shortDescUa}<br>${shortDescUa}<br>${shortDescUa}`;
  const sanitized = sanitizeWfpProductName(longWithTags);
  assert.ok(sanitized.length <= 255);
  assert.equal(sanitized.includes("<br>"), false);

  const combined = buildWfpProductName(shortUa, shortDescUa);
  assert.ok(combined.length <= 255);
  assert.ok(combined.startsWith(shortDescUa.slice(0, 5)));

  // Return URL flow
  const returnUrl = buildReturnUrl("https://example.com/", "short", "short_20260201_abcdef");
  assert.equal(
    returnUrl,
    "https://example.com/pay/return?product=short&order_ref=short_20260201_abcdef"
  );

  console.log("smoke: ok");
}

run();
