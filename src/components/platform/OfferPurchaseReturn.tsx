/**
 * The confirmation, on the page the buyer just bought from.
 *
 * WHY IT IS NOT ENOUGH TO LET THE HERO SAY «АКТИВНА». The hero learns about
 * ownership by asking the shelf, and the shelf only answers for somebody who is
 * SIGNED IN with the address they paid with. A person who bought as a guest —
 * which the checkout allows — would land back on the page they came from, see
 * the sales pitch again, and have no evidence their money went anywhere. That
 * is a worse ending than the confirmation screen this replaces.
 *
 * So the notice is driven by the RETURN PARAMETERS, not by access: if the
 * payment route sent someone here with an order reference, the payment
 * happened, and the page says so before it knows who they are. When the shelf
 * then confirms ownership, the hero and the outline change underneath — two
 * statements about the same fact, arriving in the order they can be known.
 *
 * It also carries `PurchaseSignal`, which is the reason `/pay/thanks` could not
 * simply be dropped: that component fires the browser-side `Purchase` with the
 * `purchase_<order_ref>` event id the WayForPay webhook pairs with server-side.
 * Move the landing without moving the signal and Meta counts every sale twice.
 */

import { PurchaseSignal } from "@/components/platform/PurchaseSignal";
import { formatPrice } from "@/lib/products";
import commerceStyles from "./PlatformOfferCommerce.module.css";
import styles from "./PlatformOfferStyles";

export type PurchaseReturn = {
  orderRef: string;
  product: string;
  contentName: string;
  transactionId: string | null;
  value: number | null;
  currency: string;
};

export function OfferPurchaseReturn({
  purchase,
  telegramHref = null,
}: {
  purchase: PurchaseReturn;
  /** The order's one-tap link to the bot; null once a chat is linked or the return is old. */
  telegramHref?: string | null;
}) {
  const receipt = [
    `Номер платежу: ${purchase.transactionId || purchase.orderRef}`,
    purchase.value ? formatPrice(purchase.value, purchase.currency) : null,
    purchase.contentName,
  ].filter(Boolean) as string[];

  return (
    <section
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="support"
      data-cw-semantic-family="support-boundary"
      data-cw-token-source="global-app-ds"
      aria-label="Підтвердження оплати"
    >
      <PurchaseSignal
        orderRef={purchase.orderRef}
        product={purchase.product}
        contentName={purchase.contentName}
        transactionId={purchase.transactionId}
        value={purchase.value}
        currency={purchase.currency}
      />
      <article className={styles.panel}>
        <p className={styles.label}>Оплата пройшла</p>
        <h2 className={styles.title}>Дякуємо — програма ваша</h2>
        <p className={styles.lead}>
          {/* Says the sign-in condition PLAINLY, because for a guest buyer it is
              the difference between having the course and not finding it. The
              page cannot tell here whether they are signed in — that answer
              arrives in the browser a moment later — so it states the rule once
              rather than guessing. */}
          Доступ прив&apos;язаний до пошти, яку ви вказали при оплаті. Увійдіть із нею — і курс відкриється просто тут,
          разом з усіма уроками.
        </p>
        <ul className={styles.timeline}>
          {receipt.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {/* THE ONE TAP AFTER PAYING (owner, 2026-10-14). Reminders and «старт
            завтра» reach a buyer only through a linked chat, and a minute after
            paying is when a person is most willing to open the bot. The link
            names the order, so it works before any sign-in. Secondary: the
            page's filled button stays the course's own. */}
        {telegramHref ? (
          <>
            <p className={styles.lead}>
              Щоб не пропустити старт і уроки, підключіть Telegram — нагадування приходитимуть туди.
            </p>
            <div className={commerceStyles.statusActions}>
              <a
                className={commerceStyles.statusSecondaryAction}
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Отримувати нагадування в Telegram
              </a>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}

/**
 * The return parameters, read once.
 *
 * Returns `null` when there is no order reference, which is the normal case —
 * this page is an offer page first and a confirmation only when someone has
 * just come back from paying.
 */
export function readPurchaseReturn(
  params: Record<string, string | string[] | undefined>,
  offer: { pixelContentName: string; currency: string } | null,
): Omit<PurchaseReturn, "product"> | null {
  const first = (value: string | string[] | undefined): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const orderRef = first(params.order_ref) ?? first(params.orderReference);
  if (!orderRef) return null;

  const rawAmount = first(params.amount);
  const parsed = rawAmount ? Number(rawAmount.replace(",", ".")) : NaN;

  return {
    orderRef,
    contentName: offer?.pixelContentName ?? "CenterWay",
    transactionId: first(params.payment_id) ?? first(params.rrn),
    value: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    currency: (first(params.currency) ?? offer?.currency ?? "UAH").toUpperCase(),
  };
}
