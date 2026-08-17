import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformOfferStyles";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

type PlatformOfferCardProps = {
  title: string;
  tag: string;
  description: string;
  href: string | null;
  visual: string;
  slug?: string;
  artwork?: PlatformOfferArtwork;
  ctaLabel?: string;
  size?: "default" | "compact";
  /** Short format line (duration, question count) under the title. */
  meta?: string;
  /** "planned" renders the tile without a link, as a surface that does not exist yet. */
  status?: "active" | "planned";
  statusLabel?: string;
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
  meta,
  status = "active",
  statusLabel = "Скоро",
}: PlatformOfferCardProps) {
  const cardStyle = artwork?.desktop
    ? ({
        "--program-photo-image": `url("${artwork.desktop}")`,
        "--program-photo-image-mobile": `url("${artwork.mobile ?? artwork.desktop}")`,
        "--program-photo-position-desktop": artwork.desktopPosition ?? "center 20%",
        "--program-photo-position-mobile": artwork.mobilePosition ?? "center 42%",
      } as CSSProperties)
    : undefined;

  const isPlanned = status === "planned" || !href;

  return (
    <article
      className={styles.programTile}
      data-visual={visual}
      data-size={size}
      data-program={slug}
      data-status={isPlanned ? "planned" : "active"}
      data-has-art={artwork?.desktop ? "true" : "false"}
      style={cardStyle}
    >
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody} data-has-meta={meta ? "true" : "false"}>
        <p className={styles.label}>{tag}</p>
        <h3>{title}</h3>
        {meta ? <p className={styles.programTileMeta}>{meta}</p> : null}
        <p>{description}</p>
        {isPlanned ? (
          <span className={styles.programTileStatus}>{statusLabel}</span>
        ) : (
          <Link className={styles.programLink} href={href}>
            {ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
