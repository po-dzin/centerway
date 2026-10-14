import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import commerceStyles from "@/components/platform/PlatformOfferCommerce.module.css";
import { SUPPORT_BOT_URL } from "@/lib/telegram/tgSupportBotCopy";
import type { CheckoutSummary } from "@/lib/platform/checkoutSummary";
import { CheckoutBackLink, CheckoutForm } from "./CheckoutForm";
import styles from "./PlatformCheckout.module.css";

/**
 * `/pay/checkout` — the one step between a buy button and the gateway.
 *
 * Two halves, read left to right on a desktop and top to bottom on a phone:
 * WHAT is being bought (name, what one payment includes, the sum) and WHERE
 * access goes (one address, or the account already signed in). Every buy
 * button on the platform and on the landings leads here, so the buyer sees
 * the order before the gateway's page and every order is bound to an address
 * before it exists (`/api/pay/start`).
 *
 * The summary is the quieter, sunk half: it is information to check. The form
 * is the raised panel with the page's one primary action.
 */
export function CheckoutScreen({
  summary,
  fields,
  accountEmail,
  gatewayLabel,
}: {
  summary: CheckoutSummary;
  fields: [string, string][];
  accountEmail: string | null;
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

            <article className={styles.summary} aria-labelledby="cw-checkout-product">
              <p className={offerStyles.label}>Ваше замовлення</p>
              <div className={styles.product}>
                {summary.cover ? (
                  /* Plain <img>, as on the catalogue card: a cover can be an
                     author's upload on any host. The name beside it says what
                     the picture is. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.cover} src={summary.cover.src} alt="" decoding="async" />
                ) : null}
                <div className={styles.productText}>
                  <h1 id="cw-checkout-product" className={styles.productTitle}>
                    {summary.title}
                  </h1>
                  {summary.formatLabel ? <p className={styles.productFormat}>{summary.formatLabel}</p> : null}
                </div>
              </div>

              <ul className={commerceStyles.includes}>
                {summary.includes.map((item) => (
                  <li key={item}>
                    <Icon className={commerceStyles.includeMark} name="check" size={20} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className={styles.total}>
                <p className={styles.totalLabel}>До сплати</p>
                <div className={commerceStyles.priceRow}>
                  {summary.compareAtPrice ? <s className={commerceStyles.priceOld}>{summary.compareAtPrice}</s> : null}
                  <p className={commerceStyles.priceValue}>{summary.price}</p>
                </div>
              </div>
            </article>

            <article className={`${offerStyles.formPanel} ${styles.formPanel}`} aria-labelledby="cw-checkout-title">
              <h2 id="cw-checkout-title" className={styles.formTitle}>
                Куди надіслати доступ?
              </h2>

              <CheckoutForm fields={fields} accountEmail={accountEmail} />

              <p className={commerceStyles.fineprint}>
                Оплата на захищеній сторінці {gatewayLabel}: картка, Apple Pay або Google Pay. Дані картки до нас не
                потрапляють. Натискаючи кнопку, ви приймаєте <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
                <Link href="/legal/privacy">політику конфіденційності</Link>.
              </p>
              <p className={commerceStyles.fineprint}>
                Є питання? <a href={SUPPORT_BOT_URL}>Напишіть у підтримку</a> в Telegram.
              </p>
            </article>
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}
