import { AuthorCard } from "@/components/platform/AuthorCard";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import type { Author } from "@/lms-core";

/**
 * The authors, on the consultation page.
 *
 * The card itself is `AuthorCard` and nothing else — this block used to draw
 * its own, and the same founder read as two different objects depending on
 * whether you met him here or on the home page.
 */
export function ConsultantDirectory({ authors }: { authors: Author[] }) {
  if (authors.length === 0) return null;
  return <PlatformBlock id="consultants" label="Провідники" title="Автори CenterWay" lead="Познайомтеся з авторами, подивіться їхній досвід і відкрийте профіль того, з ким хочете продовжити розмову.">
    <div className={`${styles.guideRail} ${styles.consultantRail}`} data-layout={authors.length === 1 ? "single" : undefined}>
      {authors.map((author) => <AuthorCard key={author.slug} author={author} />)}
    </div>
  </PlatformBlock>;
}
