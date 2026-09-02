/**
 * `/experts` — every author with a public page, alphabetically.
 *
 * `listListedAuthors()` already does the `listed = true` filter and the
 * ordering; this page only lays the result out.
 */

import type { Metadata } from "next";

import { AuthorCard } from "@/components/platform/AuthorCard";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import trustStyles from "@/components/platform/PlatformTrustStyles";
import { listListedAuthors } from "@/lib/lms/authors";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Автори",
  description: describe("Хто веде курси й програми на платформі CenterWay."),
  path: "/experts",
});

export default async function ExpertsIndexPage() {
  const authors = await listListedAuthors();

  return (
    <PlatformShell>
      <>
        <PlatformBlock id="authors" label="Автори" title="Автори CenterWay" lead="Хто веде курси й програми на платформі.">
          <div className={trustStyles.guideRail} data-layout={authors.length === 1 ? "single" : undefined}>
            {/* One card everywhere an author is previewed — the home block,
                /consult and this index render the same component, and the
                destination comes from `authorHref` inside it. */}
            {authors.map((author) => (
              <AuthorCard key={author.slug} author={author} />
            ))}
          </div>
        </PlatformBlock>
      </>
    </PlatformShell>
  );
}
