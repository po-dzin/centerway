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
  /**
   * The card's own context lines — when this offer is appropriate, what it does
   * not replace, where it belongs. Three at most.
   *
   * These used to live OUTSIDE the card, as a prose panel above it: on the home
   * page the herb block ran three icon notes and a "Як читати" panel before the
   * one card they described, so the reader met three paragraphs about a product
   * they could not yet see. The context belongs to the product, so it travels
   * with the product — which is also what makes this card usable for a second
   * and a third product without writing a new panel for each.
   */
  points?: readonly string[];
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
  points,
  status = "active",
  statusLabel = "Скоро",
}: PlatformOfferCardProps) {
  const cardStyle = artwork?.desktop
    ? ({
        "--program-photo-image": `url("${artwork.desktop}")`,
        /* Cards keep one horizontal master at every breakpoint. The optional
           portrait is reserved for the standalone offer hero on mobile. */
        "--program-photo-image-mobile": `url("${artwork.desktop}")`,
        "--program-photo-position-desktop": artwork.desktopPosition ?? "center 20%",
        "--program-photo-position-mobile": artwork.desktopPosition ?? "center 20%",
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
      <div
        className={styles.programTileBody}
        data-has-meta={meta ? "true" : "false"}
        data-has-points={points && points.length > 0 ? "true" : "false"}
      >
        <p className={styles.label}>{tag}</p>
        <h3>{title}</h3>
        {meta ? <p className={styles.programTileMeta}>{meta}</p> : null}
        <p>{description}</p>
        {points && points.length > 0 ? (
          <ul className={styles.programTilePoints}>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
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
