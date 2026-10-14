import { Icon } from "@/components/Icon";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import commerceStyles from "@/components/platform/PlatformOfferCommerce.module.css";
import styles from "./PlatformCheckout.module.css";

/**
 * ORDER SUMMARY — what is being bought, as information to check.
 *
 * A design-system component of its own (docs/design-system.md → «Checkout: two
 * components»): the sunk material and no shadow, because nothing here is a
 * control; the sum sits at the foot under the system's fading rule, so beside
 * a taller neighbour the card stretches and the total stays at the bottom.
 * Every value is passed in — the checkout page reads them from the offer row
 * (`checkoutSummary.ts`) — so the card cannot quote a price of its own.
 */
export function OrderSummary({
  title,
  formatLabel,
  cover,
  includes,
  price,
  compareAtPrice,
  label = "Ваше замовлення",
  totalLabel = "До сплати",
  titleId,
}: {
  title: string;
  formatLabel?: string | null;
  cover?: { src: string; alt: string } | null;
  includes: string[];
  price: string;
  compareAtPrice?: string | null;
  label?: string;
  totalLabel?: string;
  /** The heading's id, so the card can be the page's labelled region. */
  titleId?: string;
}) {
  return (
    <article className={styles.summary} aria-labelledby={titleId}>
      <p className={offerStyles.label}>{label}</p>
      <div className={styles.product}>
        {cover ? (
          /* Plain <img>, as on the catalogue card: a cover can be an author's
             upload on any host. The name beside it says what the picture is. */
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.cover} src={cover.src} alt="" decoding="async" />
        ) : null}
        <div className={styles.productText}>
          <h1 id={titleId} className={styles.productTitle}>
            {title}
          </h1>
          {formatLabel ? <p className={styles.productFormat}>{formatLabel}</p> : null}
        </div>
      </div>

      <ul className={commerceStyles.includes}>
        {includes.map((item) => (
          <li key={item}>
            <Icon className={commerceStyles.includeMark} name="check" size={20} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className={styles.total}>
        <p className={styles.totalLabel}>{totalLabel}</p>
        <div className={commerceStyles.priceRow}>
          {compareAtPrice ? <s className={commerceStyles.priceOld}>{compareAtPrice}</s> : null}
          <p className={commerceStyles.priceValue}>{price}</p>
        </div>
      </div>
    </article>
  );
}
