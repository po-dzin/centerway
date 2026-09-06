/**
 * WHERE AN AUTHOR LIVES — the two pure rules about an author's address, kept
 * apart from the data module that reads them.
 *
 * `authors.ts` imports `next/cache` and the admin Supabase client, so anything
 * importing it is a server module. `AuthorCard` needs nothing from that file
 * except the href, and the cabinet's editor renders that card live beside the
 * form — a client component. One string function in a server module is what
 * made the whole data layer a build error in the browser bundle.
 */

import type { Author } from "@/lms-core";

/**
 * The founder's public address is `/consult`, not `/expert/<slug>` — see the
 * `/expert` merge (2026-08-23): the consultation is what someone arrives
 * wanting, and the founder's credentials are evidence on that page rather than
 * a page of their own. Every other author gets the address their profile has.
 *
 * BOTH TRANSLITERATIONS, because the product persists both and the link must be
 * right whichever row is live: the static showcase card in
 * `src/lib/platform/content.ts` is `evgeniy-koryakin`, while the seeding
 * migrations under `docs/migration/sql` write `yevhenii-koriakin`. Matching one
 * of them is how this exception silently stopped firing — the card linked to a
 * profile page instead of the consultation.
 *
 * It lives HERE, beside the data, rather than in a block: `/experts` derived
 * the same destination independently and got it wrong in its own way, which is
 * what a rule copied into two call sites does.
 */
const FOUNDER_SLUGS: readonly string[] = ["evgeniy-koryakin", "yevhenii-koriakin"];

/**
 * Whether this slug is the founder's, under either transliteration.
 *
 * The PAGE needs this as well as the link: publishing his profile so the home
 * page can print it would otherwise also mint `/expert/<slug>`, which is the
 * second page about him that the 2026-08-23 merge existed to remove. The route
 * redirects on this predicate, so the link and the page cannot disagree about
 * who the exception is.
 */
export function isFounderAuthorSlug(slug: string): boolean {
  return FOUNDER_SLUGS.includes(slug);
}

/** Where an author's card should point. */
export function authorHref(author: Pick<Author, "slug">): string {
  return `/expert/${author.slug}`;
}
