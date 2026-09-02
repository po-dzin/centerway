import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import type { OfferCommerce } from "@/lib/platform/offerCommerce";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

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
        {commerce.compareAtPrice ? <s className={styles.priceOld}>{commerce.compareAtPrice}</s> : null}
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

/** A free course starts the LMS path directly; it must never enter checkout. */
export function OfferFreePanel({
  commerce,
  label,
  title,
  lead,
  includes,
  ctaLabel,
}: {
  commerce: Extract<OfferCommerce, { mode: "free" }>;
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
        {commerce.compareAtPrice ? <s className={styles.priceOld}>{commerce.compareAtPrice}</s> : null}
        <p className={styles.priceValue}>{commerce.price}</p>
        <p className={styles.priceNote}>без оплати</p>
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
      <Link className={styles.buyAction} href={commerce.accessHref} data-cw-offer-cta>
        {ctaLabel}
      </Link>
      <p className={styles.fineprint}>Якщо ви ще не увійшли, платформа попросить авторизуватися перед стартом.</p>
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
