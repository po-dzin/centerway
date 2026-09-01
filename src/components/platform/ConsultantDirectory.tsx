import Link from "next/link";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import { authorHref } from "@/lib/lms/authors";
import type { Author } from "@/lms-core";

export function ConsultantDirectory({ authors }: { authors: Author[] }) {
  const consultants = authors.filter((author) => author.consultation?.enabled);
  if (consultants.length === 0) return null;
  return <PlatformBlock id="consultants" label="Провідники" title="Оберіть автора консультації" lead="Відкрийте профіль, подивіться досвід і домовтеся про розмову напряму.">
    <div className={styles.guideRail} data-layout={consultants.length === 1 ? "single" : undefined}>
      {consultants.map((author) => <Link key={author.slug} href={authorHref(author)} className={styles.guideCard}>
        <div className={styles.guideMedia}>
          {author.photo ? <>
            {/* Cabinet portraits may be public Supabase Storage URLs. Plain img
                keeps an external photo from blocking this entire directory. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.guidePortrait} src={author.photo.src} alt={author.photo.alt} loading="lazy" decoding="async" />
          </> : <span className={styles.guideFallback} aria-hidden="true">{author.name.trim().charAt(0).toUpperCase()}</span>}
          {(author.experienceBadge || author.achievementBadge) ? <div className={styles.guideBadges}>
            {author.experienceBadge ? <span>{author.experienceBadge}</span> : null}
            {author.achievementBadge ? <span>{author.achievementBadge}</span> : null}
          </div> : null}
        </div>
        <div className={styles.guideBody}>
          <div className={styles.guideIdentity}>
            <h3 className={styles.guideName}>{author.name}</h3>
            {author.role ? <p className={styles.guideRole}>{author.role}</p> : null}
          </div>
          {author.bio ? <p className={styles.guideNote}>{author.bio}</p> : author.consultation?.summary ? <p className={styles.guideNote}>{author.consultation.summary}</p> : null}
          {author.facts?.length ? <ul className={styles.guideFacts}>{author.facts.slice(0, 3).map((fact) => <li key={fact}><span>{fact}</span></li>)}</ul> : null}
        </div>
      </Link>)}
    </div>
  </PlatformBlock>;
}
