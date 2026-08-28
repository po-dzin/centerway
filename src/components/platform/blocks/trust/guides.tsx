import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import { platformGuides, type PlatformGuide } from "@/lib/platform/content";

/**
 * Who runs this — as a list with one entry, not as one person's panel.
 *
 * The block this replaced had Євгеній written into its markup: his photograph,
 * his sentence and his four facts inline, in a layout shaped for exactly one
 * author. That is the wrong shape for a platform whose courses already carry an
 * author id and whose builder is used by whoever owns a course — a second guide
 * would have meant rewriting the block rather than adding a row.
 *
 * It renders `platformGuides`, and it is built so the single card looks
 * finished on its own. `data-layout="single"` is the same switch the products
 * block uses for one product: a lone card takes the panorama shape (portrait
 * beside the copy) instead of standing as one column with three empty cells
 * beside it. Two or more, and every card becomes a column with the portrait on
 * top — the marketplace shape, at one size.
 */
export function HubGuides() {
  const guides = platformGuides;
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

function GuideCard({ guide }: { guide: PlatformGuide }) {
  return (
    <article className={styles.guideCard}>
      <div className={styles.guideMedia}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.guidePortrait} src={guide.photo.src} alt={guide.photo.alt} loading="lazy" decoding="async" />
      </div>
      <div className={styles.guideBody}>
        <div className={styles.guideIdentity}>
          <h3 className={styles.guideName}>{guide.name}</h3>
          <p className={styles.guideRole}>{guide.role}</p>
        </div>
        <p className={styles.guideNote}>{guide.note}</p>
        {/* A list is text (see docs/design-system.md). These were four plates in
            a 2×2 grid inside a card — six surfaces to say four short facts, and
            the plates read as pressable when none of them are. */}
        <ul className={styles.guideFacts}>
          {guide.facts.map((fact) => (
            <li key={fact.label}>
              <Icon className={styles.guideFactIcon} name={fact.icon} size={20} />
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
        <Link className={styles.guideLink} href={guide.href}>
          {guide.linkLabel}
        </Link>
      </div>
    </article>
  );
}
