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
import {
  applyCheckoutGate,
  applyPriceSync,
  collectCheckoutCodes,
  collectPriceCodes,
  type LandingPrices,
} from "./priceSync";

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

/**
 * The products a page offers to sell that it may not sell.
 *
 * `loadPayableOffer` is the only authority — the same call the checkout makes
 * — so a landing cannot open a buy button the payment route would refuse. It
 * answers `null` for a price nobody agreed, for a package quoted beside a lead
 * form, and for a withdrawn offer; all three mean the same thing to a CTA.
 *
 * A THROWN READ CLOSES THE BUTTON. `loadPayableOffer` already absorbs a
 * database failure into the product's constant, so anything reaching here is
 * unexpected, and the two ways to be wrong are not equal: sending a buyer to
 * the enquiry form costs a form submission, and charging them a figure nobody
 * agreed costs a refund and the trust behind it.
 */
export async function resolveClosedCheckouts(codes: string[]): Promise<Set<string>> {
  const closed = new Set<string>();
  if (codes.length === 0) return closed;

  await Promise.all(
    codes.map(async (code) => {
      try {
        if (!(await loadPayableOffer(code))) closed.add(code);
      } catch (error) {
        console.warn("landing_checkout_gate_read_failed", {
          code,
          error: error instanceof Error ? error.message : String(error),
        });
        closed.add(code);
      }
    })
  );

  return closed;
}

/** True when the page quotes money or offers to take it — the cheap test callers gate on. */
export function hasLandingCommerce(html: string): boolean {
  return collectPriceCodes(html).length > 0 || collectCheckoutCodes(html).length > 0;
}

/**
 * One pass over a landing's commercial claims: what it prints, and what it sells.
 *
 * Both halves in one function on purpose. They read the same source and have to
 * agree — a page printing a figure it cannot charge, or charging a figure it
 * does not print, is the exact failure `priceSync` was written for, and two
 * call sites each wiring their own half is how that comes back.
 */
export async function syncLandingCommerce(html: string): Promise<string> {
  const [prices, closed] = await Promise.all([
    resolveLandingPrices(html),
    resolveClosedCheckouts(collectCheckoutCodes(html)),
  ]);

  return applyCheckoutGate(applyPriceSync(html, prices), closed);
}
