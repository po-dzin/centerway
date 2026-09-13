import Link from "next/link";

import styles from "@/components/platform/PlatformTrustStyles";
import { authorHref } from "@/lib/lms/authorRoutes";
import { authorCardCropStyle } from "@/lib/lms/authorPhoto";
import type { Author } from "@/lms-core";

/**
 * ONE AUTHOR CARD, EVERYWHERE AN AUTHOR IS PREVIEWED.
 *
 * The same person was drawn by three different pieces of markup — the home
 * block, `/consult`'s directory and `/experts` — and the three had already
 * drifted. A reader who meets Євгеній on the home page and again on the
 * consultation page has to be looking at one object, so there is one component.
 *
 * THE PORTRAIT LIES IN A FIELD (2026-09-13) — the card system's inset
 * photograph, in the person's frame (`--ds-card-portrait-ratio`, 4:5). It used
 * to be the ground of the whole card with the name, the facts and the button
 * over a scrim that started a third of the way down and was darkest across the
 * person's shoulders and hands — the part of a portrait that says who someone
 * is. Now the whole person is visible and the copy is ink on paper under them.
 */
export function AuthorCard({ author, ctaLabel = "Більше про автора" }: { author: Author; ctaLabel?: string }) {
  /* Three, each clamped to three lines: «Магістр комплементарної медицини та
     інтегративної психології» is a real credential and needs them at phone
     width. The rest of the six live on the profile the card links to. */
  const facts = author.facts?.slice(0, 3) ?? [];
  /* The badges say "20 років практики" and so does the first fact — on the
     card that showed both, the reader read the same sentence twice. They carry
     the same claim, so only the list shows when there is a list to show. */
  const badges =
    facts.length === 0
      ? [author.experienceBadge, author.achievementBadge].filter((badge): badge is string => Boolean(badge))
      : [];
  const note =
    facts.length === 0 ? (author.bio ?? author.consultation?.summary ?? author.credentials?.join(" · ")) : null;

  return (
    <article className={styles.guideCard} data-cw-material="matte" data-cw-edge="none">
      {/* The card IS the link — the button below is its label, not a second
          target. One anchor keeps the tab order and the a11y tree honest. */}
      <Link className={styles.guideOverlay} href={authorHref(author)} aria-label={author.name} />
      <div className={styles.guideMedia}>
        {author.photo ? (
          /* Cabinet portraits may be public Supabase Storage URLs. A plain img
             keeps an external photo from blocking the rail it sits in. */
          // eslint-disable-next-line @next/next/no-img-element
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
        {badges.length > 0 ? (
          <div className={styles.guideBadges}>
            {badges.map((badge) => (
              <span className={styles.guideBadge} key={badge}>
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
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
