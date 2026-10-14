import { Icon } from "@/components/Icon";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import { CheckoutForm, type CheckoutInitial } from "./CheckoutForm";
import styles from "./PlatformCheckout.module.css";

/**
 * ADDRESS PANEL — who access goes to (a name, an address, a phone or Telegram),
 * and the one action that leaves for the gateway.
 *
 * A design-system component of its own (docs/design-system.md → «Checkout: two
 * components»): the offer panel's raised material, because it holds the page's
 * one primary control. Question first, field (or the signed-in account) and
 * the gold button under it, and one line naming the gateway under that.
 */
export function AddressPanel({
  fields,
  accountEmail,
  initial,
  gatewayLabel,
  title = "Кому надіслати доступ?",
  titleId,
}: {
  /** Hidden fields carried to `/api/pay/start` (product, attribution, event id). */
  fields: [string, string][];
  /** A verified session address; when present the field is not asked. */
  accountEmail: string | null;
  /** What the page already knows: fields sent back by the route, or the signed-in buyer's saved name and messenger. */
  initial: CheckoutInitial;
  /** The active gateway's own name, so the gateway line never names the wrong one. */
  gatewayLabel: string;
  title?: string;
  titleId?: string;
}) {
  return (
    <article className={`${offerStyles.formPanel} ${styles.formPanel}`} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.formTitle}>
        {title}
      </h2>

      <CheckoutForm fields={fields} accountEmail={accountEmail} initial={initial} />

      {/* ONE LINE UNDER THE BUTTON (owner, 2026-10-14). It was a paragraph:
          card types, where card data goes, the offer, support. The buyer needs
          one fact here — who takes the money — and the gateway's own page says
          the rest. */}
      <p className={styles.gateway}>
        <Icon name="lock" size={20} aria-hidden />
        <span>
          Оплата через <b>{gatewayLabel}</b>
        </span>
      </p>
    </article>
  );
}
