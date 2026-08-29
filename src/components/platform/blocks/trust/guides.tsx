import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import { authorHref, listListedAuthors } from "@/lib/lms/authors";
import { platformGuides } from "@/lib/platform/content";
import type { Author } from "@/lms-core";

/**
 * THE STATIC CARD IS A FLOOR, NOT A DEFAULT. `listListedAuthors()` turns every
 * database and client error into `[]` on purpose, so "Supabase is unreachable"
 * and "nobody has published a profile" arrive here as the same value. Treating
 * that value as "no authors" deleted the whole trust block from the home page
 * on a transient read failure — a page that has said who runs this since it
 * existed, going silent because a query timed out.
 *
 * So an empty read falls back to the showcase's own founder card, which is
 * complete and already lives in `content.ts`. The platform's editorial line is
 * "showcase in code, LMS in the database"; this is that line held at the point
 * where the database is the thing that failed.
 */
function fallbackGuides(): Author[] {
  return platformGuides.map((guide) => ({
    id: `static:${guide.slug}`,
    slug: guide.slug,
    name: guide.name,
    role: guide.role,
    bio: guide.note,
    photo: guide.photo,
    credentials: guide.facts.map((fact) => fact.label),
  }));
}

/**
 * Who runs this — as a list with one entry, not as one person's panel.
 *
 * The block this replaced had Євгеній written into its markup: his photograph,
 * his sentence and his four facts inline, in a layout shaped for exactly one
 * author. That is the wrong shape for a platform whose courses already carry an
 * author id and whose builder is used by whoever owns a course — a second guide
 * would have meant rewriting the block rather than adding a row.
 *
 * It renders `listListedAuthors()` now, not a hand-written constant — the
 * profile an author fills in from their own cabinet is what shows up here.
 * `data-layout="single"` is the same switch the products block uses for one
 * product: a lone card takes the panorama shape (portrait beside the copy)
 * instead of standing as one column with three empty cells beside it. Two or
 * more, and every card becomes a column with the portrait on top — the
 * marketplace shape, at one size.
 */
export async function HubGuides() {
  const listed = await listListedAuthors();
  const guides = listed.length > 0 ? listed : fallbackGuides();
  if (guides.length === 0) return null;

  const single = guides.length === 1;

  return (
    <PlatformBlock
      id="author"
      label="Провідники"
      /* The heading follows the data rather than the intention: calling one
         person «Провідники» is a promise the page cannot keep yet. */
      title={single ? "Про автора" : "Провідники CenterWay"}
      lead="Хто веде цей процес і як відбувається супровід?"
    >
      <div className={styles.guideRail} data-layout={single ? "single" : undefined}>
        {guides.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} />
        ))}
      </div>
    </PlatformBlock>
  );
}

function GuideCard({ guide }: { guide: Author }) {
  return (
    <article className={styles.guideCard}>
      {guide.photo ? (
        <div className={styles.guideMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.guidePortrait} src={guide.photo.src} alt={guide.photo.alt} loading="lazy" decoding="async" />
        </div>
      ) : null}
      <div className={styles.guideBody}>
        <div className={styles.guideIdentity}>
          <h3 className={styles.guideName}>{guide.name}</h3>
          {guide.role ? <p className={styles.guideRole}>{guide.role}</p> : null}
        </div>
        {guide.bio ? <p className={styles.guideNote}>{guide.bio}</p> : null}
        {/* A list is text (see docs/design-system.md). These were four plates in
            a 2×2 grid inside a card — six surfaces to say four short facts, and
            the plates read as pressable when none of them are. */}
        {guide.credentials && guide.credentials.length > 0 ? (
          <ul className={styles.guideFacts}>
            {guide.credentials.map((line) => (
              <li key={line}>
                <Icon className={styles.guideFactIcon} name="star" size={20} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link className={styles.guideLink} href={authorHref(guide)}>
          Більше про автора
        </Link>
      </div>
    </article>
  );
}
