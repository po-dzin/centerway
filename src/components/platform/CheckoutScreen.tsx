import { PlatformShell } from "@/components/platform/PlatformLayout";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import type { CheckoutSummary } from "@/lib/platform/checkoutSummary";
import { AddressPanel } from "./AddressPanel";
import { CheckoutBackLink, type CheckoutInitial } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";
import styles from "./PlatformCheckout.module.css";

/**
 * `/pay/checkout` — the one step between a buy button and the gateway.
 *
 * Two halves, read left to right on a desktop and top to bottom on a phone:
 * WHAT is being bought (name, what one payment includes, the sum) and WHO
 * access goes to (a name, one address or the signed-in account, and one
 * messenger). Every buy
 * button on the platform and on the landings leads here, so the buyer sees
 * the order before the gateway's page and every order is bound to an address
 * before it exists (`/api/pay/start`).
 *
 * The page only arranges two design-system components: `OrderSummary`
 * (information to check) and `AddressPanel` (the page's one primary action),
 * both on the platform card's raised material. On a desktop the two stand at
 * one height.
 */
export function CheckoutScreen({
  summary,
  fields,
  accountEmail,
  initial,
  gatewayLabel,
}: {
  summary: CheckoutSummary;
  fields: [string, string][];
  accountEmail: string | null;
  initial: CheckoutInitial;
  gatewayLabel: string;
}) {
  return (
    /* `default`: the page opens on the canvas, not on a photograph. */
    <PlatformShell headerMode="default">
      <main data-cw-platform-template="pay-checkout">
        <section
          className={`${offerStyles.container} ${offerStyles.section}`}
          data-cw-semantic-role="offer-detail"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.layout}>
            <CheckoutBackLink href={summary.offerHref} />

            <OrderSummary
              titleId="cw-checkout-product"
              title={summary.title}
              formatLabel={summary.formatLabel}
              cover={summary.cover}
              includes={summary.includes}
              price={summary.price}
              compareAtPrice={summary.compareAtPrice}
            />

            <AddressPanel
              titleId="cw-checkout-title"
              fields={fields}
              accountEmail={accountEmail}
              initial={initial}
              gatewayLabel={gatewayLabel}
            />
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}
