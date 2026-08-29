import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformOfferStyles";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

/**
 * One offer, as a preview.
 *
 * THE PREVIEW FORMAT, stated once here and enforced in CSS: an eyebrow of one
 * line, a name of one line, three lines of description. It is a fixed shape so
 * that a rail of cards reads as one object and so that a course written in the
 * builder cannot push the two cards beside it out of alignment with a long
 * title. The strings are cut to fit before they arrive — see
 * src/lib/platform/offerPreview.ts — and the CSS ceilings catch the rest.
 */
type PlatformOfferCardProps = {
  /** The NAME, one line. Not the name plus what it is — `offerName` cuts that. */
  title: string;
  /**
   * The eyebrow, one line: the same badge the offer page prints over its own
   * title (kind · duration), built with `offerEyebrow`. Never the tagline —
   * that is a sentence, and this row is set in uppercase.
   */
  tag: string;
  /** Why this exists. Three lines; the rest is on the page it links to. */
  description: string;
  href: string | null;
  visual: string;
  slug?: string;
  artwork?: PlatformOfferArtwork;
  ctaLabel?: string;
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
  /**
   * WHAT KIND OF THING THIS IS, in the corner of the plate.
   *
   * Separate from `tag` on purpose. The eyebrow is a line of prose in the body
   * («Міні-курс · 3 дні») and is read after the picture; this is a chip ON the
   * picture, which is read WITH it — and "am I looking at a course or a
   * checklist" is the question a reader answers before they read anything.
   *
   * Only authored courses set it, because only they carry `kind`. A card
   * without one is the card as it has always been: the kind stays in the
   * eyebrow, where the six hand-written offers still put it.
   */
  kindBadge?: string;
  /**
   * What it is about — one to three words each, already translated. Codes never
   * reach this component; a card renders, it does not own a vocabulary.
   */
  categories?: readonly string[];
  /** "planned" renders the tile without a link, as a surface that does not exist yet. */
  status?: "active" | "planned";
  statusLabel?: string;
  /**
   * The author's own line above the title, when they wrote one — see
   * `StorefrontCard.pretitle`. Shares the eyebrow's grid row rather than
   * claiming a new one, so a card that has none keeps the fixed preview
   * format exactly as it was.
   */
  pretitle?: string;
  /** The line below the title, in the author's own words — `StorefrontCard.posttitle`. */
  posttitle?: string;
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
  meta,
  points,
  kindBadge,
  categories,
  status = "active",
  statusLabel = "Скоро",
  pretitle,
  posttitle,
}: PlatformOfferCardProps) {
  /* THE CARD IS NOT A HERO. It is roughly 370 CSS pixels wide in the grid, and
     it was drawing the same 1600px plate the full-bleed hero draws — six of them
     on the home page, measured at just over a megabyte of background image. The
     960px copy covers this card on a 2× screen at about a fifth of the weight.

     `desktop` remains the fallback, so a plate with no small copy — a cover a
     course carries from the database, an author's own upload — behaves exactly
     as it did before. */
  const photo = artwork?.card ?? artwork?.desktop;

  const cardStyle = artwork && photo
    ? ({
        "--program-photo-image": `url("${photo}")`,
        /* Cards keep one horizontal master at every breakpoint. The optional
           portrait is reserved for the standalone offer hero on mobile. */
        "--program-photo-image-mobile": `url("${photo}")`,
        "--program-photo-position-desktop": artwork.desktopPosition ?? "center 20%",
        "--program-photo-position-mobile": artwork.desktopPosition ?? "center 20%",
      } as CSSProperties)
    : undefined;

  const isPlanned = status === "planned" || !href;

  return (
    <article
      className={styles.programTile}
      data-visual={visual}
      data-program={slug}
      data-status={isPlanned ? "planned" : "active"}
      data-has-art={artwork?.desktop ? "true" : "false"}
      style={cardStyle}
    >
      <div className={styles.programPhoto} aria-hidden="true" />
      {/* ON the plate, not in the body — see `kindBadge`. It sits before the
          link overlay in the DOM and under it in z-order, so it is a label the
          card carries rather than a second thing to click. */}
      {kindBadge ? <p className={styles.programTileKind}>{kindBadge}</p> : null}
      {/* The card IS the choice, so the whole card routes — the visible CTA below
          is its label, not the only way in. This overlay is the single real link
          in the card: making the CTA a link too would put two links with the same
          destination in the a11y tree and in the tab order. */}
      {isPlanned ? null : (
        <Link className={styles.programTileOverlay} href={href} aria-label={title} />
      )}
      <div
        className={styles.programTileBody}
        data-has-meta={meta ? "true" : "false"}
        data-has-points={points && points.length > 0 ? "true" : "false"}
      >
        <div className={styles.programTileEyebrow}>
          <p className={styles.label}>{tag}</p>
          {pretitle ? <p className={styles.programTilePretitle}>{pretitle}</p> : null}
        </div>
        <div className={styles.programTileHeadline}>
          <h3>{title}</h3>
          {posttitle ? <p className={styles.programTilePosttitle}>{posttitle}</p> : null}
        </div>
        {categories && categories.length > 0 ? (
          <ul className={styles.programTileCategories}>
            {categories.map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
        ) : null}
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
          /* Not a link: the overlay above already is one, and it covers this.
             Kept as a span so the card offers one target, not two. */
          <span className={styles.programLink}>{ctaLabel}</span>
        )}
      </div>
    </article>
  );
}
