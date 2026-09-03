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
 * one call.
 *
 * WHAT MAY BE PRINTED IS NOT WHAT MAY BE CHARGED, and that is why
 * `product_offers` is consulted first. A guided package is agreed in
 * conversation: its landing quotes «9000 грн» beside a lead form, and
 * `loadPayableOffer` deliberately answers `null` for it so that no buy button
 * can open at that figure. Asking only the payable path would leave every
 * enquiry product printing whatever was typed into the HTML — the owner could
 * set a quote in the admin and the page it appears on would never move, which
 * is the whole thing this was built to fix.
 *
 * So: the row's figure is the printed one when a row exists, and the payable
 * offer answers for everything else. The distinction already exists in this
 * codebase as `amount` versus `listAmount`; this is the same split one level up.
 */

import { loadPayableOffer } from "@/lib/platform/offers";
import { loadProductOffer } from "@/lib/platform/productOffers";
import { collectPriceCodes, type LandingPrices } from "./priceSync";

export async function resolveLandingPrices(html: string): Promise<LandingPrices> {
  const codes = collectPriceCodes(html);
  if (codes.length === 0) return {};

  const entries = await Promise.all(
    codes.map(async (code) => {
      try {
        /* A product priced in `product_offers` — an enquiry package, the herbal
           blend — answers here even when it has no checkout to charge. */
        const row = await loadProductOffer(code);
        if (row) {
          if (row.amount === null) return null; // «ціна за запитом»: the typed text stands.
          return [code, { amount: row.amount, listAmount: row.listAmount }] as const;
        }

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
