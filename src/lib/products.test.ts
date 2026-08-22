import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LANDING_STATIC_BRANDS, UTILITY_FILE_BY_PAGE } from "@/lib/landing/contracts";
import {
  PLATFORM_FAILED_URL,
  PLATFORM_THANKS_URL,
  PRODUCTS,
  isPayableProduct,
  normalizeProduct,
  type CatalogProductCode,
} from "@/lib/products";
import { getSnapshotCourseByProgram } from "@/lib/lms/catalog";
import { buildReturnDestination } from "@/lib/payReturn";

const payableCodes = Object.keys(PRODUCTS) as CatalogProductCode[];

/**
 * The gap this covers: way21-support, consult and herbs each sat in a state
 * where one half of the purchase chain existed and the other did not — a
 * product priced with no way to buy it, or a checkout landing on a thanks page
 * that was never written. Both failures are invisible until someone pays.
 *
 * Since 2026-08-21 the return is ONE platform pair for every product, so what
 * these assert changed shape: not "each funnel has its own two documents" but
 * "every product returns to the platform's confirmation, and that confirmation
 * knows where the thing it sold is delivered".
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

  it("returns every product to the one platform confirmation", () => {
    for (const code of payableCodes) {
      const product = PRODUCTS[code];
      expect(product.approvedUrl, `${code} approvedUrl`).toBe(PLATFORM_THANKS_URL);
      expect(product.declinedUrl, `${code} declinedUrl`).toBe(PLATFORM_FAILED_URL);
    }

    // The canonical platform origin, not the apex: the proxy 308s the bare host
    // onto www, and a redirect inside a payment return only loses people.
    for (const raw of [PLATFORM_THANKS_URL, PLATFORM_FAILED_URL]) {
      const url = new URL(raw);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.centerway.net.ua");
    }
    expect(new URL(PLATFORM_THANKS_URL).pathname).toBe("/pay/thanks");
    expect(new URL(PLATFORM_FAILED_URL).pathname).toBe("/pay/failed");
  });

  it("has a route file for each of those two paths", () => {
    for (const raw of [PLATFORM_THANKS_URL, PLATFORM_FAILED_URL]) {
      const route = path.join(
        process.cwd(),
        "src/app/(platform)",
        new URL(raw).pathname,
        "page.tsx"
      );
      expect(existsSync(route), `missing route for ${raw}`).toBe(true);
    }
  });

  /**
   * The static pages are no longer the destination, but they are still the one
   * an in-flight invoice returns to: WayForPay stores the return URL with the
   * invoice. Deleting them would 404 exactly the people who paid last.
   */
  it("keeps the funnel confirmation documents reachable for in-flight invoices", () => {
    for (const dir of ["short", "irem", "way21", "reset-day", "herbs"]) {
      expect(LANDING_STATIC_BRANDS.has(dir), `${dir} is not a static landing brand`).toBe(true);
      for (const file of [UTILITY_FILE_BY_PAGE.thanks, UTILITY_FILE_BY_PAGE["pay-failed"]]) {
        const filePath = path.join(process.cwd(), "src", "landing-static", dir, file);
        expect(existsSync(filePath), `missing ${dir}/${file}`).toBe(true);
      }
    }
  });

  /**
   * Every payable product has to say where the thing it sold is delivered.
   * Before this existed the answer was a hard-coded href inside whichever
   * thanks page the funnel happened to own, and the two bot products had a
   * `?start=` token that lived nowhere else.
   */
  it("declares a fulfilment for every payable product", () => {
    for (const code of payableCodes) {
      const fulfilment = PRODUCTS[code].fulfilment;
      expect(PRODUCTS[code].pixelContentName.length, `${code} pixelContentName`).toBeGreaterThan(0);

      if (fulfilment.kind === "bot") {
        const url = new URL(fulfilment.url);
        expect(url.protocol).toBe("https:");
        expect(url.searchParams.get("start"), `${code} bot link needs a start token`).toBeTruthy();
      } else if (fulfilment.kind === "course") {
        expect(getSnapshotCourseByProgram(fulfilment.courseSlug), `${code} names a course nothing serves`).not.toBeNull();
      }
    }
  });

  it("builds a return destination carrying the order back to the platform", () => {
    for (const code of payableCodes) {
      const paid = new URL(
        buildReturnDestination("paid", code, `qa_${code}`, { rrn: "QA1", amount: "1", currency: "UAH" }, 0)
      );
      expect(paid.origin).toBe(new URL(PLATFORM_THANKS_URL).origin);
      expect(paid.pathname).toBe("/pay/thanks");
      expect(paid.searchParams.get("order_ref")).toBe(`qa_${code}`);
      expect(paid.searchParams.get("product")).toBe(code);

      const failed = new URL(buildReturnDestination("failed", code, `qa_${code}`, {}, 0));
      expect(failed.pathname).toBe("/pay/failed");
    }
  });
});
