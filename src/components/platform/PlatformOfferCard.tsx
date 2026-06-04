import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformOfferStyles";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

type PlatformOfferCardProps = {
  title: string;
  tag: string;
  description: string;
  href: string;
  visual: string;
  slug?: string;
  artwork?: PlatformOfferArtwork;
  ctaLabel?: string;
  size?: "default" | "compact";
};

export function PlatformOfferCard({
  title,
  tag,
  description,
  href,
  visual,
  slug,
  artwork,
  ctaLabel = "Деталі продукту",
  size = "default",
}: PlatformOfferCardProps) {
  const cardStyle = artwork?.desktop
    ? ({
        "--program-photo-image": `url("${artwork.desktop}")`,
        "--program-photo-image-mobile": `url("${artwork.mobile ?? artwork.desktop}")`,
        "--program-photo-position-desktop": artwork.desktopPosition ?? "center 20%",
        "--program-photo-position-mobile": artwork.mobilePosition ?? "center 42%",
      } as CSSProperties)
    : undefined;

  return (
    <article
      className={styles.programTile}
      data-visual={visual}
      data-size={size}
      data-program={slug}
      data-has-art={artwork?.desktop ? "true" : "false"}
      style={cardStyle}
    >
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{tag}</p>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link className={styles.programLink} href={href}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
