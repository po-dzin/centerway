import Link from "next/link";

import offerStyles from "@/components/platform/PlatformOfferStyles";
import commerceStyles from "@/components/platform/PlatformOfferCommerce.module.css";
import { SUPPORT_BOT_URL } from "@/lib/telegram/tgSupportBotCopy";
import { CheckoutForm } from "./CheckoutForm";
import styles from "./PlatformCheckout.module.css";

/**
 * ADDRESS PANEL — where access goes, and the one action that leaves for the
 * gateway.
 *
 * A design-system component of its own (docs/design-system.md → «Checkout: two
 * components»): the offer panel's raised material, because it holds the page's
 * one primary control. Question first, field (or the signed-in account) and
 * the gold button under it; the fine print sits at the foot, so beside a
 * taller summary the panel stretches without the button drifting away from
 * the field it submits.
 */
export function AddressPanel({
  fields,
  accountEmail,
  gatewayLabel,
  title = "Куди надіслати доступ?",
  titleId,
}: {
  /** Hidden fields carried to `/api/pay/start` (product, attribution, event id). */
  fields: [string, string][];
  /** A verified session address; when present the field is not asked. */
  accountEmail: string | null;
  /** The active gateway's own name, so the fine print never names the wrong one. */
  gatewayLabel: string;
  title?: string;
  titleId?: string;
}) {
  return (
    <article className={`${offerStyles.formPanel} ${styles.formPanel}`} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.formTitle}>
        {title}
      </h2>

      <CheckoutForm fields={fields} accountEmail={accountEmail} />

      <div className={styles.fineprint}>
        <p className={commerceStyles.fineprint}>
          Оплата на захищеній сторінці {gatewayLabel}: картка, Apple Pay або Google Pay. Дані картки до нас не
          потрапляють. Натискаючи кнопку, ви приймаєте <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
          <Link href="/legal/privacy">політику конфіденційності</Link>.
        </p>
        <p className={commerceStyles.fineprint}>
          Є питання? <a href={SUPPORT_BOT_URL}>Напишіть у підтримку</a> в Telegram.
        </p>
      </div>
    </article>
  );
}
