import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LANDING_STATIC_BRANDS, UTILITY_FILE_BY_PAGE } from "@/lib/landing/contracts";
import { PRODUCTS, isPayableProduct, normalizeProduct, type PayableProductCode } from "@/lib/products";
import { buildReturnDestination } from "@/lib/payReturn";
import { getProductByHost } from "@/lib/surfaces/catalog";

const payableCodes = Object.keys(PRODUCTS) as PayableProductCode[];

/**
 * The gap this covers: way21-support, consult and herbs each sat in a state
 * where one half of the purchase chain existed and the other did not — a
 * product priced with no way to buy it, or a checkout landing on a thanks page
 * that was never written. Both failures are invisible until someone pays.
 */
describe("payable product chain", () => {
  it("routes every payable code through isPayableProduct", () => {
    for (const code of payableCodes) {
      expect(isPayableProduct(code), `${code} must be payable`).toBe(true);
      expect(normalizeProduct(code), `${code} must survive normalization`).toBe(code);
    }
  });

  it("charges a positive amount in a known currency", () => {
    for (const code of payableCodes) {
      const product = PRODUCTS[code];
      expect(product.amount, `${code} amount`).toBeGreaterThan(0);
      expect(Number.isInteger(product.amount), `${code} amount must be whole`).toBe(true);
      expect(product.currency, `${code} currency`).toBe("UAH");
    }
  });

  it("points both return URLs at a funnel host this app actually serves", () => {
    for (const code of payableCodes) {
      const product = PRODUCTS[code];
      for (const [label, raw] of [
        ["approvedUrl", product.approvedUrl],
        ["declinedUrl", product.declinedUrl],
      ] as const) {
        const url = new URL(raw);
        expect(url.protocol, `${code} ${label} must be https`).toBe("https:");
        expect(
          getProductByHost(url.hostname),
          `${code} ${label} host ${url.hostname} is not a known funnel host`
        ).not.toBeNull();
      }
      expect(new URL(product.approvedUrl).pathname).toBe("/thanks");
      expect(new URL(product.declinedUrl).pathname).toBe("/pay-failed");
    }
  });

  it("has the thanks and pay-failed documents those URLs resolve to", () => {
    for (const code of payableCodes) {
      const brand = getProductByHost(new URL(PRODUCTS[code].approvedUrl).hostname);
      // reboot's static assets live under /short — the surface key and the
      // landing-static directory only diverge for that one funnel.
      const dir = brand === "reboot" ? "short" : brand;
      expect(LANDING_STATIC_BRANDS.has(String(dir)), `${code}: ${dir} is not a static landing brand`).toBe(true);

      for (const file of [UTILITY_FILE_BY_PAGE.thanks, UTILITY_FILE_BY_PAGE["pay-failed"]]) {
        const filePath = path.join(process.cwd(), "src", "landing-static", String(dir), file);
        expect(existsSync(filePath), `${code}: missing ${dir}/${file}`).toBe(true);
      }
    }
  });

  it("builds a return destination carrying the order back to the funnel", () => {
    for (const code of payableCodes) {
      const paid = new URL(
        buildReturnDestination("paid", code, `qa_${code}`, { rrn: "QA1", amount: "1", currency: "UAH" }, 0)
      );
      expect(paid.origin).toBe(new URL(PRODUCTS[code].approvedUrl).origin);
      expect(paid.searchParams.get("order_ref")).toBe(`qa_${code}`);
      expect(paid.searchParams.get("product")).toBe(code);

      const failed = new URL(buildReturnDestination("failed", code, `qa_${code}`, {}, 0));
      expect(failed.pathname).toBe("/pay-failed");
    }
  });
});
