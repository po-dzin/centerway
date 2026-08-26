import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { PlatformTrail, type TrailStep } from "@/components/platform/PlatformTrail";
import type { OfferCommerce } from "@/lib/platform/offerCommerce";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

/**
 * The way back up.
 *
 * A detail page is reached from an index, and until now it had no control that
 * said so — the only route back was the header item for the whole section, or
 * the browser's own button.
 *
 * Uses `PlatformTrail`, the same breadcrumb the course player and the builder
 * draw, rather than a back-link of its own. The platform briefly had both, and
 * two idioms for "where am I and how do I get out" is one more than a reader
 * should have to learn.
 *
 * Rendered under the hero rather than inside it: the hero is a photograph with
 * a dark topbar over it, and a quiet text control put there is the first thing
 * that disappears.
 */
export function OfferTrail({ steps }: { steps: TrailStep[] }) {
  return (
    <div className={styles.backRow}>
      <PlatformTrail steps={steps} />
    </div>
  );
}

/**
 * The panel that sells, in place of the form that asked.
 *
 * Deliberately a plain anchor, never next/link: `/api/pay/start` is a route
 * handler that CREATES AN ORDER and redirects, and a prefetched Link would
 * open an invoice for every reader who scrolled past the button.
 *
 * The figure is the quoted price (`productListPrice`), never the charged one —
 * they diverge while the 1 ₴ QA window is open, and a page reading the charged
 * amount would advertise a hryvnia.
 */
export function OfferCheckoutPanel({
  commerce,
  label,
  title,
  lead,
  includes,
  ctaLabel,
}: {
  commerce: Extract<OfferCommerce, { mode: "checkout" }>;
  label: string;
  title: string;
  lead: string;
  includes: string[];
  ctaLabel: string;
}) {
  return (
    <article className={offerStyles.formPanel}>
      <p className={offerStyles.label}>{label}</p>
      <h2 className={offerStyles.title}>{title}</h2>

      <div className={styles.priceRow}>
        <p className={styles.priceValue}>{commerce.price}</p>
        <p className={styles.priceNote}>разова оплата</p>
      </div>

      <p className={styles.fineprint}>{lead}</p>

      <ul className={styles.includes}>
        {includes.map((item) => (
          <li key={item}>
            <Icon className={styles.includeMark} name="check" size={20} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <a className={styles.buyAction} href={commerce.checkoutHref} rel="nofollow" data-cw-offer-cta>
        {ctaLabel}
      </a>

      <p className={styles.fineprint}>
        Оплата карткою через WayForPay. Натискаючи кнопку, ви приймаєте{" "}
        <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
        <Link href="/legal/privacy">політику конфіденційності</Link>.
      </p>
    </article>
  );
}

/** A generic panel wrapper, so the lead branch keeps the same shape as the buy one. */
export function OfferSupportPanel({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={offerStyles.formPanel}>
      <p className={offerStyles.label}>{label}</p>
      <h2 className={offerStyles.title}>{title}</h2>
      {children}
    </article>
  );
}
