/**
 * The author behind a course, read for the offer page and for their own profile.
 *
 * WHY THE LINK IS NOT ON `Course`. `lms_courses.author_profile_id` is a foreign
 * key, and `Course` is the portable contract that has to run unchanged inside a
 * native renderer with no database at all (see `src/lms-core/index.ts`). Putting
 * a row id in it would export an id that means nothing outside this one
 * Postgres. So the join happens here, by course slug, and the page receives an
 * `Author` — a value, not a pointer.
 *
 * WHY THE SERVICE ROLE. `lms_authors` publishes only `listed` profiles through
 * RLS. A course offer page prints the byline of whoever wrote it whether or not
 * that person has published a page about themselves — the profile being
 * unlisted means "do not give me an address", not "do not say my name".
 */

import { unstable_cache, revalidateTag } from "next/cache";

import { adminClient } from "@/lib/auth/adminClient";
import { validateAuthor, slugify, uniqueSlug, type Author } from "@/lms-core";
import { listStorefrontCourses, type StorefrontCard } from "@/lib/platform/offers";
import { COURSE_LIST_TAG, PURGE } from "@/lib/lms/liveCatalog";

type Row = Record<string, unknown>;

/** Cache tag for one author, so an edit can drop exactly that entry. */
export function authorTag(slug: string): string {
  return `lms-author:${slug}`;
}

/** Cache tag for anything that lists authors. */
export const AUTHOR_LIST_TAG = "lms-authors";

/** Same backstop as the course reads — invalidation is by tag, this only bounds staleness. */
const REVALIDATE_SECONDS = 120;

function authorFromRow(row: Row): Author {
  const author = {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    ...(row.role ? { role: row.role as string } : {}),
    ...(row.bio ? { bio: row.bio as string } : {}),
    ...(row.quote ? { quote: row.quote as string } : {}),
    ...(Array.isArray(row.credentials) && row.credentials.length > 0
      ? { credentials: row.credentials as string[] }
      : {}),
    ...(row.photo ? { photo: row.photo as Author["photo"] } : {}),
    // `false` reads back as ABSENT, the same way `visibility: "hidden"` does on
    // a course: it is the column's own default, and carrying it explicitly would
    // put a field on every author that says what its absence already says.
    ...(row.listed === true ? { listed: true } : {}),
  };

  validateAuthor(author, `db:${String(row.slug)}`);
  return author;
}

/**
 * Never throws. An author is a byline, and a failed byline read must not take
 * down the offer page it sits on — the page renders without the block, which is
 * the same thing it does for a course whose author was never set.
 */
async function readCourseAuthor(courseSlug: string): Promise<Author | null> {
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("lms_courses")
      .select("author_profile_id, lms_authors!lms_courses_author_profile_id_fkey(*)")
      .eq("slug", courseSlug)
      .maybeSingle();

    if (error || !data) return null;

    // PostgREST returns an embedded to-one relation as an object, but types it
    // loosely enough that an array is worth surviving.
    const embedded = (data as Row).lms_authors;
    const row = Array.isArray(embedded) ? embedded[0] : embedded;
    return row ? authorFromRow(row as Row) : null;
  } catch (error) {
    console.warn(
      `lms_course_author_unavailable:${courseSlug}:${error instanceof Error ? error.message : "unknown_error"}`
    );
    return null;
  }
}

export async function getCourseAuthor(courseSlug: string): Promise<Author | null> {
  return unstable_cache(() => readCourseAuthor(courseSlug), ["lms-course-author", courseSlug], {
    tags: [AUTHOR_LIST_TAG, `lms-course:${courseSlug}`],
    revalidate: REVALIDATE_SECONDS,
  })();
}

async function readAuthor(slug: string): Promise<Author | null> {
  try {
    const db = adminClient();
    const { data, error } = await db.from("lms_authors").select("*").eq("slug", slug).maybeSingle();
    if (error || !data) return null;
    return authorFromRow(data as Row);
  } catch {
    return null;
  }
}

/**
 * One author by their profile slug. Returns unlisted profiles too — the caller
 * owns the gate, exactly as `getLiveCourse` returns drafts and lets the route
 * decide. A profile PAGE must refuse an unlisted author; a course page printing
 * the same person's name must not.
 */
export async function getAuthor(slug: string): Promise<Author | null> {
  return unstable_cache(() => readAuthor(slug), ["lms-author", slug], {
    tags: [authorTag(slug), AUTHOR_LIST_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}

async function readListedAuthors(): Promise<Author[]> {
  try {
    const db = adminClient();
    const { data, error } = await db.from("lms_authors").select("*").eq("listed", true).order("name");
    if (error) return [];

    const authors: Author[] = [];
    for (const row of (data ?? []) as Row[]) {
      try {
        authors.push(authorFromRow(row));
      } catch (invalid) {
        // One malformed profile must not empty the directory for the rest.
        console.warn(
          `lms_author_invalid:${String(row.slug)}:${invalid instanceof Error ? invalid.message : ""}`
        );
      }
    }
    return authors;
  } catch {
    return [];
  }
}

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
  return isFounderAuthorSlug(author.slug) ? "/consult" : `/expert/${author.slug}`;
}

/** Every author with a public page, for the directory. */
export async function listListedAuthors(): Promise<Author[]> {
  return unstable_cache(readListedAuthors, ["lms-authors-listed"], {
    tags: [AUTHOR_LIST_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}

async function readCoursesByAuthor(authorId: string): Promise<StorefrontCard[]> {
  const db = adminClient();
  const { data, error } = await db.from("lms_courses").select("slug").eq("author_profile_id", authorId);
  if (error || !data) return [];

  const slugs = new Set(data.map((row) => row.slug as string));
  if (slugs.size === 0) return [];

  // Reuses the catalogue's own public/listed filter and card shape rather than
  // re-deriving one here — a card on an author's page has to be the same card
  // the catalogue would show for the same course.
  const cards = await listStorefrontCourses();
  return cards.filter((card) => slugs.has(card.slug));
}

/** A listed author's courses, for their public profile page. */
export async function listCoursesByAuthor(authorId: string): Promise<StorefrontCard[]> {
  /* COURSE_LIST_TAG is here because of what this cache actually HOLDS: the
     entry is built from `listStorefrontCourses()`, so publishing, unpublishing,
     renaming or re-describing a course changes it. Those writes purge
     COURSE_LIST_TAG and the per-course tags, neither of which used to appear
     here — so an author's page could keep showing an unpublished course, or
     miss a newly published one, until the fallback expired. A cache has to
     carry the tags of everything it read, not only of the row it is named for. */
  return unstable_cache(() => readCoursesByAuthor(authorId), ["lms-author-courses", authorId], {
    tags: [AUTHOR_LIST_TAG, COURSE_LIST_TAG, `lms-author-courses:${authorId}`],
    revalidate: REVALIDATE_SECONDS,
  })();
}

/**
 * One user's own author row, self or draft included — the cabinet editor's
 * read. Unlike `getAuthor`, this never filters on `listed`: an author has to
 * see and edit a profile they have not published yet.
 */
async function findAuthorByUser(userId: string): Promise<Row | null> {
  const db = adminClient();
  const { data, error } = await db.from("lms_authors").select("*").eq("auth_user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

/**
 * Whether this user may see the author-profile editor at all: they already
 * hold a byline, or they hold at least one course's edit rights
 * (`lms_courses.author_id`). Gates the cabinet section — a learner who has
 * never authored anything should not be offered a profile to publish.
 */
export async function isEligibleAuthor(userId: string): Promise<boolean> {
  const db = adminClient();
  const [existing, owned] = await Promise.all([
    db.from("lms_authors").select("id").eq("auth_user_id", userId).maybeSingle(),
    db.from("lms_courses").select("id", { count: "exact", head: true }).eq("author_id", userId),
  ]);
  return Boolean(existing.data) || (owned.count ?? 0) > 0;
}

export type AuthorProfileForUser = { eligible: boolean; author: Author | null };

/** What the cabinet's GET returns: whether to show the editor, and the draft to fill it with. */
export async function getAuthorProfileForUser(userId: string): Promise<AuthorProfileForUser> {
  const [eligible, row] = await Promise.all([isEligibleAuthor(userId), findAuthorByUser(userId)]);
  return { eligible, author: row ? authorFromRow(row) : null };
}

export type AuthorProfileInput = {
  name: string;
  role?: string;
  bio?: string;
  quote?: string;
  credentials?: string[];
  photo?: { src: string; alt: string };
  listed?: boolean;
  slug?: string;
};

export type UpsertAuthorProfileResult =
  | { ok: true; author: Author }
  | { ok: false; error: "not_an_author" | "invalid_profile" | "slug_conflict" | "db_error" };

/**
 * Create or update the caller's own `lms_authors` row.
 *
 * `auth_user_id` is never taken from `input` — it is the caller's own id,
 * always, so this function cannot be made to write someone else's profile no
 * matter what a request body claims. `onConflict: "auth_user_id"` is safe
 * because that column already carries a unique constraint.
 */
export async function upsertAuthorProfile(
  userId: string,
  input: AuthorProfileInput
): Promise<UpsertAuthorProfileResult> {
  if (!(await isEligibleAuthor(userId))) return { ok: false, error: "not_an_author" };

  const db = adminClient();
  const existing = await findAuthorByUser(userId);

  const requestedSlug = input.slug?.trim();
  let slug = existing ? (existing.slug as string) : "";
  if (requestedSlug) {
    slug = slugify(requestedSlug);
  } else if (!slug) {
    const { data: rows } = await db.from("lms_authors").select("slug");
    slug = uniqueSlug(input.name, (rows ?? []).map((row) => row.slug as string));
  }

  if (slug !== existing?.slug) {
    const { data: collision } = await db.from("lms_authors").select("id").eq("slug", slug).maybeSingle();
    if (collision && collision.id !== existing?.id) return { ok: false, error: "slug_conflict" };
  }

  const candidate = {
    id: (existing?.id as string) ?? slug,
    slug,
    name: input.name,
    ...(input.role ? { role: input.role } : {}),
    ...(input.bio ? { bio: input.bio } : {}),
    ...(input.quote ? { quote: input.quote } : {}),
    ...(input.credentials ? { credentials: input.credentials } : {}),
    ...(input.photo ? { photo: input.photo } : {}),
    ...(input.listed ? { listed: true } : {}),
  };

  try {
    validateAuthor(candidate, "cabinet:draft");
  } catch {
    return { ok: false, error: "invalid_profile" };
  }

  const { data, error } = await db
    .from("lms_authors")
    .upsert(
      {
        auth_user_id: userId,
        slug,
        name: input.name,
        role: input.role ?? null,
        bio: input.bio ?? null,
        quote: input.quote ?? null,
        credentials: input.credentials ?? null,
        photo: input.photo ?? null,
        listed: input.listed ?? false,
      },
      { onConflict: "auth_user_id" }
    )
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "db_error" };

  revalidateTag(authorTag(slug), PURGE);
  revalidateTag(AUTHOR_LIST_TAG, PURGE);
  if (existing?.slug && existing.slug !== slug) revalidateTag(authorTag(existing.slug as string), PURGE);

  return { ok: true, author: authorFromRow(data as Row) };
}

/** The raw `author_profile_id` on a course row, for the builder — no join, no cache. */
export async function getCourseAuthorProfileId(courseId: string): Promise<string | null> {
  const db = adminClient();
  const { data } = await db.from("lms_courses").select("author_profile_id").eq("id", courseId).maybeSingle();
  return (data?.author_profile_id as string | null) ?? null;
}

/**
 * Sets or clears the byline on one course.
 *
 * Deliberately the only write path into `author_profile_id` — the builder
 * route that calls this never accepts an arbitrary id from the request body,
 * only "the caller's own profile" or "none" (see the route's own comment).
 * Anything richer than that (crediting a co-author, a ghost-written course) is
 * a picker this product does not have yet.
 */
export async function linkCourseAuthorProfile(
  courseId: string,
  authorProfileId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = adminClient();
  const { error } = await db.from("lms_courses").update({ author_profile_id: authorProfileId }).eq("id", courseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
