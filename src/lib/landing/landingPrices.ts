/**
 * Reads the prices a landing page asks for, from the one place that owns them.
 *
 * Split from `priceSync` so the substitution stays pure and testable without a
 * database, and so this — the part that touches the network — is the only piece
 * that can fail. It never throws: a landing must render with a stale figure
 * rather than not render at all.
 *
 * `loadPayableOffer` rather than a direct table read, on purpose. It is the
 * same function the checkout charges from, including its alias step, so the
 * number printed on the page and the number WayForPay is asked for come from
 * one call. Products that legitimately still live in `PRODUCTS` — the guided
 * package, the herbal blend — resolve through it too, so this works for them
 * without knowing which kind they are.
 */

import { loadPayableOffer } from "@/lib/platform/offers";
import { collectPriceCodes, type LandingPrices } from "./priceSync";

export async function resolveLandingPrices(html: string): Promise<LandingPrices> {
  const codes = collectPriceCodes(html);
  if (codes.length === 0) return {};

  const entries = await Promise.all(
    codes.map(async (code) => {
      try {
        const offer = await loadPayableOffer(code);
        if (!offer) return null;
        return [code, { amount: offer.amount, listAmount: offer.listAmount ?? null }] as const;
      } catch (error) {
        console.warn("landing_price_read_failed", {
          code,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}
