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

/*
 * No author is an exception any more. Until 2026-09 the founder's card pointed
 * at `/consult` and `/expert/<his slug>` redirected there (the `/expert` merge
 * of 2026-08-23); both branches were retired when his profile became a full
 * page, and the predicate that kept them was left behind with no caller. It is
 * gone now, with the two transliterations it had to match.
 */

/** Where an author's card should point. */
export function authorHref(author: Pick<Author, "slug">): string {
  return `/expert/${author.slug}`;
}
