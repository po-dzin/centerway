import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformOfferStyles";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

/**
 * One offer, as a preview.
 *
 * THE CARD SYSTEM'S OWN CARD (docs/card-system-2026-09-13.md). Paper, with the
 * photograph lying on it in a field — inset on all four sides, every corner
 * rounded — and the copy in the platform's ink beneath it. It used to be the
 * other form: the photograph as the whole plate and cream type over a scrim
 * that had to darken 62% of the picture to keep a title legible on a light
 * cover, which is most of them. Nothing on this card sits on the photograph
 * except the kind badge, and that badge brings its own ground.
 *
 * THE PREVIEW FORMAT, stated once here and enforced in CSS: an eyebrow of one
 * line, a name of two, two lines of description, the price, one button.
 *
 * FIXED SLOTS, THE ADMIN ROW'S RULE (2026-09-17). Every field has a height of
 * its own that does not depend on the copy: the eyebrow one line (the author's
 * pretitle continues it), the headline two name lines plus one subtitle line,
 * the categories one chip row, the description two lines, the price one line.
 * A field a card does not have keeps its slot empty, so in any row, rail or
 * grid the same field sits at the same height on every card. The
 * strings are cut to fit before they arrive — see src/lib/platform/offerPreview.ts —
 * and the CSS ceilings catch the rest. The card has no fixed height: the frame
 * is a ratio, the lines are clamps, and a row stretches its cells to the tallest.
 *
 * THE CARD'S WIDTH, NOT THE SCREEN'S, DECIDES ITS DENSITY. The same card is a
 * third of a desktop row, one card of a phone carousel and half of a 375px
 * catalogue; below 14rem it drops the description and prints the short label.
 */
export type PlatformOfferCardProps = {
  /** The NAME, two lines. Not the name plus what it is — `offerName` cuts that. */
  title: string;
  /**
   * The eyebrow, one line: the same badge the offer page prints over its own
   * title (kind · duration), built with `offerEyebrow`. Never the tagline.
   */
  tag: string;
  /** Why this exists. Two lines; the rest is on the page it links to. */
  description: string;
  href: string | null;
  /** Kept as a data attribute for surfaces and smokes that key on it; it no longer draws anything. */
  visual: string;
  slug?: string;
  artwork?: PlatformOfferArtwork;
  ctaLabel?: string;
  /** Short format line (duration, question count) under the title. */
  meta?: string;
  /**
   * The card's own context lines — when this offer is appropriate, what it does
   * not replace. Three at most; hidden in a narrow card, where they would be
   * the only thing a reader saw.
   */
  points?: readonly string[];
  /**
   * WHAT KIND OF THING THIS IS, in the corner of the photograph — read WITH the
   * picture, before anything else. Only authored courses set it.
   */
  kindBadge?: string;
  /** What it is about — one to three words each, already translated. */
  categories?: readonly string[];
  /** "planned" renders the card without a link, as a surface that does not exist yet. */
  status?: "active" | "planned";
  statusLabel?: string;
  /** The author's own line above the title, when they wrote one. */
  pretitle?: string;
  /** The line below the title, in the author's own words. */
  posttitle?: string;
  commercialMode?: "fixed" | "free" | "inquiry";
  price?: string | null;
  compareAtPrice?: string | null;
};

function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/* «Деталі курсу» does not fit a 165px column on one line of a button; «Деталі»
   does, and it says the same thing on a card whose picture and title already
   named the course. A label that is not a «Деталі …» label keeps its words. */
function shortCtaLabel(label: string): string {
  return label.startsWith("Деталі") ? "Деталі" : label;
}

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
  commercialMode,
  price,
  compareAtPrice,
}: PlatformOfferCardProps) {
  /* THE CARD IS NOT A HERO. The 960px copy covers this frame on a 2× screen at
     about a fifth of the full plate's weight; `desktop` stays the fallback for a
     cover with no small copy. The card always reads the HORIZONTAL master and
     its framing — the portrait belongs to the standalone offer hero on a phone. */
  const photo = artwork?.card ?? artwork?.desktop;
  const position = artwork?.desktopPosition ?? "center 20%";
  const photoZoom = artwork?.desktopScale && artwork.desktopScale > 1 ? artwork.desktopScale : undefined;

  /* The author's crop is a focal point AND a magnification: scale about the
     focus, so the point they aimed at stays put and the picture grows around
     it. Declared only when there is a zoom — `scale(1)` would promote every
     card of a catalogue row to its own layer for nothing. */
  const imageStyle: CSSProperties = {
    objectPosition: position,
    ...(photoZoom ? { transform: `scale(${photoZoom})`, transformOrigin: position } : {}),
  };

  const isPlanned = status === "planned" || !href;

  return (
    <article
      className={styles.programTile}
      data-cw-material="matte"
      data-cw-edge="none"
      data-visual={visual}
      data-program={slug}
      data-status={isPlanned ? "planned" : "active"}
      data-has-art={photo ? "true" : "false"}
    >
      {/* The card IS the choice, so the whole card routes — the visible button
          below is its label, not the only way in. This overlay is the single
          real link in the card: making the button a link too would put two
          links with the same destination in the a11y tree and in the tab order. */}
      {isPlanned ? null : <Link className={styles.programTileOverlay} href={href} aria-label={title} />}
      <div className={styles.programCover}>
        {photo ? (
          /* Plain <img>: a cover can be an author's upload on any host, and a
             lazy image is what keeps six catalogue cards from loading six
             plates up front. The title beside it names the picture. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.programCoverImage}
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            style={imageStyle}
          />
        ) : (
          <span className={styles.programCoverFallback} aria-hidden="true">
            {initialsOf(title)}
          </span>
        )}
        {kindBadge ? <p className={styles.programTileKind}>{kindBadge}</p> : null}
      </div>
      <div className={styles.programTileBody}>
        <div className={styles.programTileEyebrow}>
          <p className={styles.label}>{tag}</p>
          {pretitle ? <p className={styles.programTilePretitle}>{pretitle}</p> : null}
        </div>
        <div className={styles.programTileHeadline}>
          <h3>{title}</h3>
          {posttitle ? <p className={styles.programTilePosttitle}>{posttitle}</p> : null}
        </div>
        {/* ALWAYS RENDERED, empty or not: the categories are a slot, and a card
            without them keeps the line so its description starts where its
            neighbours' does (docs/card-system-2026-09-13.md, «Слоти»). */}
        <ul className={styles.programTileCategories} aria-hidden={categories?.length ? undefined : true}>
          {categories?.map((category) => (
            <li className={styles.programTileCategory} key={category}>
              {category}
            </li>
          ))}
        </ul>
        {meta ? <p className={styles.programTileMeta}>{meta}</p> : null}
        <p className={styles.programTileDescription}>{description}</p>
        {points && points.length > 0 ? (
          <ul className={styles.programTilePoints}>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        {commercialMode ? (
          <div className={styles.programTilePrice} data-mode={commercialMode}>
            {compareAtPrice ? <s>{compareAtPrice}</s> : null}
            <strong>
              {commercialMode === "fixed" ? price : commercialMode === "free" ? "Безкоштовно" : "Ціна за запитом"}
            </strong>
          </div>
        ) : null}
        {isPlanned ? (
          <span className={styles.programTileStatus}>{statusLabel}</span>
        ) : (
          /* Not a link: the overlay above already is one, and it covers this.
             Two labels, one shown: the card's width picks which. */
          <span className={styles.programLink}>
            <span className={styles.programLinkFull}>{ctaLabel}</span>
            <span className={styles.programLinkShort} aria-hidden="true">
              {shortCtaLabel(ctaLabel)}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
