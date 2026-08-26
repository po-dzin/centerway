/**
 * The two blocks between the hero and the outline: what this is at a glance,
 * and who made it.
 *
 * Server components, both — neither depends on who is reading. Access changes
 * the hero and the outline; it does not change who the course is for.
 */

import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import type { Author } from "@/lms-core";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

type Facet = {
  title: string;
  icon: CwIconName;
  items: readonly string[];
};

/**
 * Who it is for, what it changes, what it is made of.
 *
 * EVERY CARD IS AUTHORED, and a card with nothing in it is not rendered — which
 * is why this takes three optional lists rather than three required ones. The
 * six hand-written programs answered all three in prose that only a developer
 * could edit; a course out of the builder answers as many as its author has
 * filled in, and says nothing where they have not.
 */
export function OfferBento({
  audience,
  results,
  format,
}: {
  audience?: readonly string[];
  results?: readonly string[];
  format?: readonly string[];
}) {
  const facets: Facet[] = (
    [
      { title: "Для кого", icon: "user", items: audience ?? [] },
      { title: "Що зміниться", icon: "rhythm", items: results ?? [] },
      { title: "Формат та інструменти", icon: "play", items: format ?? [] },
    ] satisfies Facet[]
  ).filter((facet) => facet.items.length > 0);

  // Nothing authored at all. Returning null rather than an empty grid: a
  // heading over three blank cards is worse than no section.
  if (facets.length === 0) return null;

  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="offer-detail"
      data-cw-semantic-family="guide-proof"
      data-cw-token-source="global-app-ds"
      id="program-facts"
    >
      <ul className={styles.bento}>
        {facets.map((facet) => (
          <li className={styles.bentoCard} key={facet.title}>
            <div className={styles.bentoCardHead}>
              <Icon name={facet.icon} size={20} />
              <h2 className={styles.bentoCardTitle}>{facet.title}</h2>
            </div>
            <ul className={styles.bentoList}>
              {facet.items.map((item) => (
                <li key={item}>
                  <Icon className={styles.bentoMark} name="check" size={20} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The person behind the course.
 *
 * TWO SOURCES, ON PURPOSE. `author` is the reusable profile — name, role, face
 * — written once and joined in. `note` is the sentence written for THIS course,
 * which is the only part that changes between a fasting protocol and a
 * breathing course by the same person. Neither is required: a course with a
 * note and no profile still says something true, and a profile with no note
 * still puts a name on the work.
 */
export function OfferAuthor({ author, note }: { author: Author | null; note?: string }) {
  if (!author && !note) return null;

  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="offer-detail"
      data-cw-semantic-family="guide-proof"
      data-cw-token-source="global-app-ds"
      id="program-author"
    >
      <article className={offerStyles.panel}>
        <p className={offerStyles.label}>Автор</p>
        <div className={styles.author}>
          {author?.photo ? (
            <Image
              className={styles.authorPhoto}
              src={author.photo.src}
              alt={author.photo.alt}
              width={88}
              height={88}
            />
          ) : null}
          <div className={styles.authorBody}>
            {author ? <h2 className={styles.authorName}>{author.name}</h2> : null}
            {author?.role ? <p className={styles.authorRole}>{author.role}</p> : null}
            {note ? <p className={styles.authorNote}>{note}</p> : null}
            {/* Only when the profile is published. An author who has not asked
                for a page does not get one linked from every course they wrote. */}
            {author?.listed ? (
              <Link className={styles.authorLink} href={`/expert/${author.slug}`}>
                Про автора <Icon name="arrow-right" size={20} />
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
