import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { heroFraming } from "@/components/platform/heroFraming";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

type DetailHeroAction = {
  href: string;
  label: string;
  kind?: "primary" | "secondary";
};

/** One fact — duration, medium, access term. Icon optional; the words carry it. */
export type DetailHeroMeta = {
  label: string;
  icon?: CwIconName;
};

type PlatformDetailHeroProps = {
  title: string;
  /**
   * What this is, between the name and the reason for it.
   *
   * Three rows, three different questions, and that is why it is its own line
   * rather than a longer title: «Розвантажувальний день» is what it is called,
   * «практикум з умовного голодування» is what it is, «Вийти з кола „стрес →
   * їжа → провина"» is why anyone would. Absent on offers that have no second
   * half to print.
   */
  subtitle?: string;
  description: string;
  badge: string;
  artwork?: PlatformOfferArtwork;
  imageAlt: string;
  templateKind?: "program" | "product";
  /**
   * The facts a reader scrolls looking for, kept where they stop looking.
   *
   * Absent on surfaces that have none — a consultation page has no lesson count
   * and no access term, and an empty pill row would say it did.
   */
  meta?: DetailHeroMeta[];
  primaryAction: DetailHeroAction;
  secondaryAction?: DetailHeroAction | null;
  /**
   * What sits between the facts and the buttons: a price, or — once the reader
   * turns out to own this — their standing in it.
   *
   * A SLOT, because the hero is server-rendered and prerendered, and who is
   * reading it is not known until the browser asks. The offer page passes a
   * client component that swaps itself; the hero stays static and stays
   * indexable. See `OfferAccess.tsx`.
   */
  commitment?: ReactNode;
  /**
   * Replaces the two default buttons outright.
   *
   * The same reasoning as `commitment` applied one element lower: «Купити» and
   * «Продовжити навчання» are not variants of one control, they are two
   * different offers, and a label swap would leave the buy anchor's href
   * pointing at the checkout for somebody who has already paid.
   */
  actions?: ReactNode;
};

export function PlatformDetailHero({
  title,
  subtitle,
  description,
  badge,
  artwork,
  imageAlt,
  templateKind,
  meta,
  primaryAction,
  secondaryAction,
  commitment,
  actions,
}: PlatformDetailHeroProps) {
  const heroStyle = heroFraming(artwork);

  return (
    <section
      className={styles.heroFeature}
      data-cw-topbar-tone="dark"
      data-cw-detail-shell="true"
      data-cw-detail-template={templateKind}
      data-cw-semantic-role="offer-orientation"
      data-cw-semantic-family="guide-proof"
      data-cw-token-source="global-app-ds"
      style={heroStyle}
    >
      <div className={styles.heroPhotoLayer}>
        <PlatformHeroPhoto artwork={artwork} alt={imageAlt} className={styles.expertImage} eager />
      </div>
      <div className={styles.heroFeatureContent}>
        <p className={styles.heroBadge}>
          <span>{badge}</span>
        </p>
        <h1 className={styles.detailHeroTitle}>{title}</h1>
        {subtitle ? <p className={styles.detailHeroSubtitle}>{subtitle}</p> : null}
        <p className={styles.heroFeatureLead}>{description}</p>
        {meta && meta.length > 0 ? (
          <ul className={styles.heroMetaList}>
            {meta.map((fact) => (
              <li className={styles.heroMetaItem} key={fact.label}>
                {fact.icon ? <Icon className={styles.heroMetaGlyph} name={fact.icon} size={20} /> : null}
                <span>{fact.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {commitment}
        {actions ?? (
          <div className={styles.heroFeatureActions}>
            <Link className={styles.heroPrimaryButton} href={primaryAction.href}>
              {primaryAction.label}
            </Link>
            {secondaryAction ? (
              <Link className={styles.heroSecondaryButton} href={secondaryAction.href}>
                <span>{secondaryAction.label}</span>
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
