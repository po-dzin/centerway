/**
 * `/experts` — every author with a public page, alphabetically.
 *
 * `listListedAuthors()` already does the `listed = true` filter and the
 * ordering; this page only lays the result out.
 */

import type { Metadata } from "next";
import Link from "next/link";

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
      <main>
        <PlatformBlock id="authors" label="Автори" title="Автори CenterWay" lead="Хто веде курси й програми на платформі.">
          <div className={trustStyles.guideRail} data-layout={authors.length === 1 ? "single" : undefined}>
            {authors.map((author) => (
              <Link key={author.slug} href={`/expert/${author.slug}`} className={trustStyles.guideCard}>
                {author.photo ? (
                  <div className={trustStyles.guideMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={trustStyles.guidePortrait}
                      src={author.photo.src}
                      alt={author.photo.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
                <div className={trustStyles.guideBody}>
                  <div className={trustStyles.guideIdentity}>
                    <h3 className={trustStyles.guideName}>{author.name}</h3>
                    {author.role ? <p className={trustStyles.guideRole}>{author.role}</p> : null}
                  </div>
                  {author.bio ? <p className={trustStyles.guideNote}>{author.bio}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        </PlatformBlock>
      </main>
    </PlatformShell>
  );
}
