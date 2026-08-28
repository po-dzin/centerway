/**
 * `/expert/[slug]` — a listed author's own page.
 *
 * NOT A CONFLICT WITH THE STATIC `expert/page.tsx`. That file is a 308 to
 * `/consult` for the exact path `/expert`; Next always resolves a static
 * segment before a dynamic one, so this route only ever matches
 * `/expert/<slug>`. `OfferAuthor` (course offer pages) and `AuthorEntry`
 * already link here — they were built ahead of this page existing.
 *
 * `listed !== true` 404s, same rule `getAuthor`'s own doc comment states: a
 * profile PAGE must refuse an unlisted author, even though a course page is
 * still allowed to print that same person's name as a byline.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import trustStyles from "@/components/platform/PlatformTrustStyles";
import { getAuthor, listCoursesByAuthor } from "@/lib/lms/authors";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

async function listedAuthor(slug: string) {
  const author = await getAuthor(slug);
  return author && author.listed === true ? author : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await listedAuthor(slug);
  if (!author) return {};

  return pageMetadata({
    title: author.name,
    description: describe(author.bio || `${author.name} — автор на платформі CenterWay.`),
    path: `/expert/${author.slug}`,
    ...(author.photo ? { image: author.photo.src, imageAlt: author.photo.alt } : {}),
  });
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await listedAuthor(slug);
  if (!author) notFound();

  const courses = await listCoursesByAuthor(author.id);

  return (
    <PlatformShell>
      <main>
        <PlatformBlock id="author" label="Автор" title={author.name} lead={author.role}>
          <div className={trustStyles.guideRail} data-layout="single">
            <article className={trustStyles.guideCard}>
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
                {author.bio ? <p className={trustStyles.guideNote}>{author.bio}</p> : null}
                {author.quote ? <p className={trustStyles.guideNote}>«{author.quote}»</p> : null}
                {author.credentials && author.credentials.length > 0 ? (
                  <ul className={trustStyles.guideFacts}>
                    {author.credentials.map((line) => (
                      <li key={line}>
                        <Icon name="star" size={20} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          </div>
        </PlatformBlock>

        {courses.length > 0 ? (
          <section className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}>
            <div className={offerStyles.sectionHeader}>
              <div>
                <p className={offerStyles.label}>Курси</p>
                <h2 className={offerStyles.sectionTitle}>Курси від {author.name}</h2>
              </div>
            </div>
            <div className={offerStyles.aggregateRail}>
              {courses.map((course) => (
                <PlatformOfferCard
                  key={course.slug}
                  title={course.title}
                  tag={course.tag}
                  description={course.description}
                  href={course.href}
                  visual={course.visual}
                  slug={course.slug}
                  artwork={course.artwork}
                  ctaLabel="Деталі курсу"
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </PlatformShell>
  );
}
