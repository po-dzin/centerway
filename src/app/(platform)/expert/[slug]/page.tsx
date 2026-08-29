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
 *
 * THE FOUNDER IS THE ONE EXCEPTION and redirects to `/consult` — see
 * `isFounderAuthorSlug`. Without this, listing his profile so the home page
 * can print it would also mint a second page about him, which is precisely
 * what the 2026-08-23 `/expert` → `/consult` merge existed to remove.
 */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { AuthorProfileShowcase } from "@/components/platform/AuthorProfileShowcase";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { getAuthor, isFounderAuthorSlug, listCoursesByAuthor } from "@/lib/lms/authors";
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
  if (isFounderAuthorSlug(slug)) permanentRedirect("/consult");

  const author = await listedAuthor(slug);
  if (!author) notFound();

  const courses = await listCoursesByAuthor(author.id);

  return (
    <PlatformShell>
      <AuthorProfileShowcase author={author} courses={courses} />
    </PlatformShell>
  );
}
