import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

type DetailHeroAction = {
  href: string;
  label: string;
  kind?: "primary" | "secondary";
};

type PlatformDetailHeroProps = {
  title: string;
  description: string;
  badge: string;
  artwork?: PlatformOfferArtwork;
  imageAlt: string;
  templateKind?: "program" | "product";
  primaryAction: DetailHeroAction;
  secondaryAction?: DetailHeroAction | null;
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
  description,
  badge,
  artwork,
  imageAlt,
  templateKind,
  primaryAction,
  secondaryAction,
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
        <p className={styles.heroBadge}>
          <span>{badge}</span>
        </p>
        <h1 className={styles.detailHeroTitle}>{title}</h1>
        <p className={styles.heroFeatureLead}>{description}</p>
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
      </div>
    </section>
  );
}
