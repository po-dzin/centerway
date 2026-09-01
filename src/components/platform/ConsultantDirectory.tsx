import Link from "next/link";
import Image from "next/image";
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
        {author.photo ? <div className={styles.guideMedia}>
          <Image className={styles.guidePortrait} src={author.photo.src} alt={author.photo.alt} width={640} height={360} />
          <div className={styles.guideBadges}>{author.experienceBadge ? <span>{author.experienceBadge}</span> : null}{author.achievementBadge ? <span>{author.achievementBadge}</span> : null}</div>
        </div> : null}
        <div className={styles.guideBody}><div className={styles.guideIdentity}><h3 className={styles.guideName}>{author.name}</h3>{author.role ? <p className={styles.guideRole}>{author.role}</p> : null}</div>
          <p className={styles.guideNote}>{author.consultation?.summary ?? author.bio}</p><span className={styles.guideLink}>Профіль і консультація</span></div>
      </Link>)}
    </div>
  </PlatformBlock>;
}
