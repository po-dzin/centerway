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
      /* «АВТОРИ», THE WORD THE REST OF THE PRODUCT USES. This block and
         `/consult` said «Провідники», `/experts` said «Автори», the course
         page says «Автор» and the routes are `/expert`, `/experts` — four
         names for one object, and a reader who meets the same person on two
         of those surfaces had to work out they were the same kind of thing.

         AND A TITLE THAT IS NOT THE LABEL AGAIN. Every other block on this
         page reads noun then sentence — «Продукти / Природна підтримка
         процесу», «Програми / Глибші формати…» — and this one read
         «Провідники / Провідники CenterWay». With the title carrying the
         sentence, the count no longer changes the heading either: one author
         or four, the question the block answers is the same. */
      label="Автори"
      title="Хто веде цей процес"
      lead="Досвід, підхід і курси — у профілі кожного автора."
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
