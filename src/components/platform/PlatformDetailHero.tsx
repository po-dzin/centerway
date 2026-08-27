import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { PlatformTrail, type TrailStep } from "@/components/platform/PlatformTrail";
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
  /**
   * The way back to the index this page was reached from, drawn INSIDE the
   * hero. It used to be a row under it, which put "where am I" below the thing
   * it locates — and on a phone, below a full-height photograph.
   */
  trail?: TrailStep[];
  /**
   * A control for the person who maintains this page rather than the one
   * reading it — today, the author's way into the Майстерня. Sits opposite the
   * trail on the same line, so an editing affordance never lands in the middle
   * of the offer.
   */
  utility?: ReactNode;
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

function resolveHeroPosition(position?: string) {
  if (!position) {
    return {
      x: "50%",
      y: "20%",
    };
  }
  const [x, y] = position.trim().split(/\s+/);
  return {
    x: x === "center" ? "50%" : x,
    y: y ?? "20%",
  };
}

export function PlatformDetailHero({
  title,
  subtitle,
  description,
  badge,
  artwork,
  imageAlt,
  templateKind,
  meta,
  trail,
  utility,
  primaryAction,
  secondaryAction,
  commitment,
  actions,
}: PlatformDetailHeroProps) {
  const desktopFocus = resolveHeroPosition(artwork?.desktopPosition);
  const mobileFocus = resolveHeroPosition(artwork?.mobilePosition ?? artwork?.desktopPosition);
  /* Only the -desktop/-mobile pair is set inline. The unsuffixed
     --hero-photo-x/y are deliberately left to PlatformResponsive.module.css,
     which picks the right one per breakpoint: setting them here too would win
     on specificity (inline beats every selector) and the mobile focal point
     would never apply. */
  const heroStyle = {
    "--hero-photo-x-desktop": desktopFocus.x,
    "--hero-photo-y-desktop": desktopFocus.y,
    "--hero-photo-x-mobile": mobileFocus.x,
    "--hero-photo-y-mobile": mobileFocus.y,
    "--hero-photo-shift-y": "0%",
    "--hero-photo-scale": "1.02",
    "--hero-photo-origin": "center center",
  } as CSSProperties;

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
        {(trail && trail.length > 0) || utility ? (
          <div className={styles.heroUtilityRow}>
            {trail && trail.length > 0 ? <PlatformTrail steps={trail} tone="media" /> : <span />}
            {utility}
          </div>
        ) : null}
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
