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

import { unstable_cache } from "next/cache";

import { adminClient } from "@/lib/auth/adminClient";
import { validateAuthor, type Author } from "@/lms-core";

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

/** Every author with a public page, for the directory. */
export async function listListedAuthors(): Promise<Author[]> {
  return unstable_cache(readListedAuthors, ["lms-authors-listed"], {
    tags: [AUTHOR_LIST_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}
