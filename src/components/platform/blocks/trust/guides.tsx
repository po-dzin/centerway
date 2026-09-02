import { AuthorCard } from "@/components/platform/AuthorCard";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import { listListedAuthors } from "@/lib/lms/authors";
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
 * Every count uses the standard card measure; full biographies and credentials
 * belong to the linked profile, not to a growing portrait on the hub.
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
      /* The block introduces people; the consultation is what a reader does
         with that introduction, and until now the home page never said so. */
      headActions={<PlatformBlockLink href="/consult" label="Консультації" />}
    >
      <div className={styles.guideRail} data-layout={single ? "single" : undefined}>
        {guides.map((guide) => (
          <AuthorCard key={guide.slug} author={guide} />
        ))}
      </div>
    </PlatformBlock>
  );
}
