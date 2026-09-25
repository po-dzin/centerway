import type { CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformOfferStyles";
import { COURSE_CATEGORIES_MAX, type CourseCategory } from "@/lms-core";
import { COURSE_CATEGORY_ICONS } from "@/lib/platform/catalogVocabulary";
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
 * THE PREVIEW FORMAT, stated once here and enforced in CSS (2026-09-20 order):
 * the promo line, the name under it, two lines of description, the categories,
 * the price, one button. The kind and the duration are ONE badge on the photo —
 * they were an eyebrow above the name and the same fact twice.
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
 * catalogue; below 14rem it keeps one line of the description, drops
 * secondary facts and stacks the price over the short action.
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
   * WHOSE WORK THIS IS — the author's name, printed in the card's conditional
   * line after the categories, the same place and style as `meta`. It is not a
   * new slot: the slot table (docs/card-system-2026-09-13.md) stays as it is,
   * and a card without an author simply has no line there.
   */
  author?: string;
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
  /**
   * The same subjects as CODES, in the same order as `categories`. The words
   * are the caller's (translated); the glyph is the card's, and it is chosen by
   * the code — never by the word, which is a translation and can change.
   */
  categoryCodes?: readonly CourseCategory[];
  /** "planned" renders the card without a link, as a surface that does not exist yet. */
  status?: "active" | "planned";
  statusLabel?: string;
  /**
   * THE PROMO — the author's own hook, printed ABOVE the name and larger than
   * it. It answers "why me", the name answers "what is this".
   */
  pretitle?: string;
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

/* «Детальніше» does not fit a 165px column on one line of a button; «Деталі»
   does, and it says the same thing on a card whose picture and title already
   named the course. A label that is not a «Детал…» label keeps its words. */
function shortCtaLabel(label: string): string {
  return label.startsWith("Детал") ? "Деталі" : label;
}

export function PlatformOfferCard({
  title,
  tag,
  description,
  href,
  visual,
  slug,
  artwork,
  ctaLabel = "Детальніше",
  meta,
  author,
  points,
  kindBadge,
  categories,
  categoryCodes,
  status = "active",
  statusLabel = "Скоро",
  pretitle,
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

  /* THE PROMO, and what stands in for it. No promo at all is a normal state
     (most courses have none): then the NAME takes the promo's place and size,
     so the card still opens on its one loudest line rather than on a small
     caption over an empty slot. */
  /* Capitalised here, not in CSS: `::first-letter` does not reach a clamped
     `-webkit-box`. */
  const rawPromo = pretitle;
  const promo = rawPromo ? rawPromo.charAt(0).toLocaleUpperCase("uk") + rawPromo.slice(1) : undefined;
  const badge = kindBadge && tag && !tag.startsWith(kindBadge) ? `${kindBadge} · ${tag}` : tag || kindBadge;

  /* Three subjects at most — the contract's write ceiling. A stored course that
     carries more still reads, it just shows the first three. */
  const subjects = (categories ?? []).slice(0, COURSE_CATEGORIES_MAX).map((label, index) => ({
    label,
    code: categoryCodes?.[index],
  }));

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
        {badge ? <p className={styles.programTileBadge}>{badge}</p> : null}
      </div>
      <div className={styles.programTileBody}>
        {/* PROMO ABOVE, NAME BELOW — one headline slot, so the description under
            it starts on the same line in every card of a row whether or not the
            author wrote a promo. The `h3` is always the NAME: it is what the
            page, the receipt and the breadcrumb call the offer. */}
        <div className={styles.programTileHeadline} data-has-promo={promo ? "true" : "false"}>
          {promo ? <p className={styles.programTilePromo}>{promo}</p> : null}
          <h3>{title}</h3>
        </div>
        <p className={styles.programTileDescription}>{description}</p>
        {/* ALWAYS RENDERED, empty or not: the categories are a slot, and a card
            without them keeps the line so its price starts where its
            neighbours' does (docs/card-system-2026-09-13.md, «Слоти»). Under
            the description now, not above it — they qualify what was just
            said rather than introduce it. A glyph in a disc with the word under
            it, three equal cells, no plate around the pair. */}
        <ul className={styles.programTileCategories} aria-hidden={subjects.length ? undefined : true}>
          {subjects.map(({ label, code }) => (
            <li className={styles.programTileCategory} key={label}>
              <span className={styles.programTileCategoryDisc} aria-hidden="true">
                {code ? <Icon name={COURSE_CATEGORY_ICONS[code]} size={20} /> : null}
              </span>
              <span className={styles.programTileCategoryLabel}>{label}</span>
            </li>
          ))}
        </ul>
        {author ? (
          <p className={styles.programTileMeta} data-cw-card-author="">
            Автор: {author}
          </p>
        ) : null}
        {meta ? <p className={styles.programTileMeta}>{meta}</p> : null}
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
          <div className={styles.programTileFooter}>
            {commercialMode ? (
              <div className={styles.programTilePrice} data-mode={commercialMode}>
                {compareAtPrice ? <s>{compareAtPrice}</s> : null}
                <strong>
                  {commercialMode === "fixed" ? price : commercialMode === "free" ? "Безкоштовно" : "Ціна за запитом"}
                </strong>
              </div>
            ) : null}
            {/* Not a link: the overlay above already is one, and it covers this.
               Two labels, one shown: the card's width picks which. */}
            <span className={styles.programLink}>
              <span className={styles.programLinkFull}>{ctaLabel}</span>
              <span className={styles.programLinkShort} aria-hidden="true">
                {shortCtaLabel(ctaLabel)}
              </span>
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
