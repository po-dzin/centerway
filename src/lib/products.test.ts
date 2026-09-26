import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LANDING_STATIC_BRANDS, UTILITY_FILE_BY_PAGE } from "@/lib/landing/contracts";
import { PLATFORM_FAILED_URL, PLATFORM_THANKS_URL } from "@/lib/products";
import { buildReturnDestination } from "@/lib/payments/payReturn";

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
  it("returns every product to the one platform confirmation", () => {
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
      const route = path.join(process.cwd(), "src/app/(platform)", new URL(raw).pathname, "page.tsx");
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
   * The paid destination SPLIT on 2026-08-26, and the split is the point.
   *
   * A course goes back to its own offer page, which shows it as owned — status,
   * unlocked lessons, a way into the last one — instead of to a screen whose
   * whole content is "you paid". Everything else keeps the confirmation, because
   * a bot delivery and a herb order genuinely have nowhere better to land.
   *
   * What must hold for BOTH: the origin, and the parameters. The origin because
   * it is baked into invoices WayForPay has already issued; the parameters
   * because `order_ref` is what fires the browser Purchase with the event id the
   * webhook pairs against, wherever the buyer lands.
   */
  it("returns a paid course to its offer page and everything else to the confirmation", () => {
    const cases: Array<[code: string, programPath: string | null, expected: string]> = [
      ["course:short", "/programs/reboot", "/programs/reboot"],
      ["way21-group", "/programs/way21", "/programs/way21"],
      ["herbs", null, "/pay/thanks"],
    ];
    for (const [code, programPath, expected] of cases) {
      const paid = new URL(
        buildReturnDestination(
          "paid",
          code,
          `qa_${code}`,
          { rrn: "QA1", amount: "1", currency: "UAH" },
          0,
          programPath,
        ),
      );
      expect(paid.origin).toBe(new URL(PLATFORM_THANKS_URL).origin);
      expect(paid.searchParams.get("order_ref")).toBe(`qa_${code}`);
      expect(paid.searchParams.get("product")).toBe(code);
      expect(paid.pathname, code).toBe(expected);

      // A FAILURE NEVER MOVES. The offer page shows a course as owned, and
      // showing it to someone whose card was declined would be the platform
      // handing over the goods on a payment that did not happen.
      const failed = new URL(buildReturnDestination("failed", code, `qa_${code}`, {}, 0, programPath));
      expect(failed.pathname).toBe("/pay/failed");
    }
  });
});
