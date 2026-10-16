import Link from "next/link";

import { Icon } from "@/components/Icon";
import { AuthorPortrait } from "@/components/platform/AuthorPortrait";
import { LEAD_FORM_ANCHOR } from "@/components/platform/LeadForm";
import { authorHref } from "@/lib/lms/authorRoutes";
import type { Author } from "@/lms-core";
import styles from "./ConsultationCard.module.css";

/**
 * ONE AUTHOR'S CONSULTATION, ON THE HUB (2026-10-16).
 *
 * The hub's card used to be `AuthorCard` — a portrait and «Більше про автора» —
 * which answered "who is this" on a page whose question is "who can I talk to,
 * and about what". So the card now leads with the consultation the author
 * describes in their cabinet: its title, up to three points.
 *
 * Two destinations, one of them a button. The whole card is the author's
 * profile (G: «всю карточку»); «Записатися» goes past the profile straight to
 * the request on it, already open. The overlay sits under the button so both
 * stay clickable and the tab order reads card, then button.
 *
 * `primary` is for a card that stands alone. Two or more in a row share one
 * secondary button each: the format-card rule is one gold button per row, and
 * among equal authors there is no one to give it to.
 */
export function ConsultationCard({ author, primary = false }: { author: Author; primary?: boolean }) {
  const consultation = author.consultation;
  if (!consultation?.enabled) return null;
  const href = authorHref(author);

  return (
    <article className={styles.card} data-cw-material="matte" data-cw-edge="none">
      <Link className={styles.overlay} href={href} aria-label={`Профіль автора: ${author.name}`} />
      <div className={styles.who}>
        <AuthorPortrait photo={author.photo} size="sm" fallback={author.name.trim().charAt(0).toUpperCase()} />
        <div className={styles.identity}>
          <p className={styles.name}>{author.name}</p>
          {author.role ? <p className={styles.role}>{author.role}</p> : null}
        </div>
      </div>
      <h3 className={styles.title}>{consultation.title || `Консультація з ${author.name}`}</h3>
      {consultation.points?.length ? (
        <ul className={styles.points}>
          {consultation.points.map((point) => (
            <li key={point}>
              <Icon name="check" size={16} />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : consultation.summary ? (
        <p className={styles.summary}>{consultation.summary}</p>
      ) : null}
      <Link className={primary ? styles.actionPrimary : styles.action} href={`${href}#${LEAD_FORM_ANCHOR}`}>
        Записатися
      </Link>
    </article>
  );
}
