import Link from "next/link";

import styles from "@/components/platform/PlatformTrustStyles";
import { authorHref } from "@/lib/lms/authors";
import { authorCardCropStyle } from "@/lib/lms/authorPhoto";
import type { Author } from "@/lms-core";

/**
 * ONE AUTHOR CARD, EVERYWHERE AN AUTHOR IS PREVIEWED.
 *
 * The same person was drawn by three different pieces of markup — the home
 * block, `/consult`'s directory and `/experts` — and the three had already
 * drifted: the home card put a star glyph in front of every fact and carried a
 * button, the directory printed a bio the home card never showed, and neither
 * agreed on which of the two pages a reader would recognise as "the same
 * card". A reader who meets Євгеній on the home page and again on the
 * consultation page has to be looking at one object, so there is one component.
 *
 * THE PHOTO FILLS THE CARD. The platform's rule for photographs (see
 * docs/design-system.md) admits exactly two forms: a horizontal image seated
 * INSIDE the card, or the photograph as the card itself. The portrait slot this
 * replaced was neither — a tall photo cropped into a short horizontal band,
 * which cut people off at the chin at some widths and at the shoulders at
 * others. So the picture is the ground, and the name, the facts and the way
 * through to the profile sit on it.
 */
export function AuthorCard({
  author,
  ctaLabel = "Більше про автора",
}: {
  author: Author;
  ctaLabel?: string;
}) {
  /* Three, because the card is a fixed height and each fact takes one line.
     The rest of the six live on the profile the card links to. */
  const facts = author.facts?.slice(0, 3) ?? [];
  /* The badges say "20 років практики" and so does the first fact — on the
     card that showed both, the reader read the same sentence twice. They carry
     the same claim, so only the list shows when there is a list to show. */
  const badges = facts.length === 0
    ? [author.experienceBadge, author.achievementBadge].filter((badge): badge is string => Boolean(badge))
    : [];
  const note = facts.length === 0
    ? author.bio ?? author.consultation?.summary ?? author.credentials?.join(" · ")
    : null;

  return (
    <article className={styles.guideCard}>
      <div className={styles.guideMedia}>
        {author.photo ? (
          /* Cabinet portraits may be public Supabase Storage URLs. A plain img
             keeps an external photo from blocking the rail it sits in. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className={styles.guidePortrait}
            src={author.photo.src}
            alt={author.photo.alt}
            loading="lazy"
            decoding="async"
            style={authorCardCropStyle(author.photo)}
          />
        ) : (
          <span className={styles.guideFallback} aria-hidden="true">
            {author.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {badges.length > 0 ? (
        <div className={styles.guideBadges}>
          {badges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      ) : null}
      {/* The card IS the link — the button below is its label, not a second
          target. One anchor keeps the tab order and the a11y tree honest. */}
      <Link className={styles.guideOverlay} href={authorHref(author)} aria-label={author.name} />
      <div className={styles.guideBody}>
        <div className={styles.guideIdentity}>
          <h3 className={styles.guideName}>{author.name}</h3>
          {author.role ? <p className={styles.guideRole}>{author.role}</p> : null}
        </div>
        {facts.length > 0 ? (
          <ul className={styles.guideFacts}>
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : note ? (
          <p className={styles.guideNote}>{note}</p>
        ) : null}
        <span className={styles.guideLink}>{ctaLabel}</span>
      </div>
    </article>
  );
}
