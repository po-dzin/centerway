import type { adminClient } from "@/lib/auth/adminClient";

/**
 * THE REGISTRY OF THINGS (2026-09-19).
 *
 * `experiences` answers one question for everything a person can buy, get, or
 * order from a human: what is it, where does it live, whose is it, is it on the
 * shelf. A course, a consultation, a support package, the dosha test and the
 * herbal blend are rows of the same table with different `kind`s.
 *
 * WHO WRITES IT. For content kinds the row is a PROJECTION of `lms_courses`,
 * kept by a database trigger — nothing in this codebase writes it, and nothing
 * should start to. For the kinds with no course behind them the row is the
 * source, and only the owner's catalogue writes it.
 *
 * WHAT IT IS NOT. Not the course card (title, cover, status and review stay on
 * `lms_courses`, under revisions), not the price (`experience_offers`), and not
 * what a person holds (`lms_enrollments`, `orders`). See
 * `docs/experiences-unification-2026-09-17.md`.
 */

type Db = ReturnType<typeof adminClient>;

export const EXPERIENCE_KINDS = [
  "course",
  "mini",
  "checklist",
  "consultation",
  "package",
  "assessment",
  "physical",
] as const;

export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

/** Kinds whose executor is `lms_courses`: the row is a projection, never edited. */
export const CONTENT_KINDS: readonly ExperienceKind[] = ["course", "mini", "checklist"];

export function isContentKind(kind: ExperienceKind): boolean {
  return CONTENT_KINDS.includes(kind);
}

export type Experience = {
  id: string;
  kind: ExperienceKind;
  slug: string;
  authorProfileId: string | null;
  listed: boolean;
  sortOrder: number | null;
  /** Only for kinds with no course behind them; a course's title is its own. */
  title: string | null;
  summary: string | null;
};

const COLUMNS = "id, kind, slug, author_profile_id, listed, sort_order, title, summary";

type ExperienceRow = {
  id: string;
  kind: string;
  slug: string;
  author_profile_id: string | null;
  listed: boolean;
  sort_order: number | null;
  title: string | null;
  summary: string | null;
};

function fromRow(row: ExperienceRow): Experience {
  return {
    id: row.id,
    kind: row.kind as ExperienceKind,
    slug: row.slug,
    authorProfileId: row.author_profile_id,
    listed: row.listed,
    sortOrder: row.sort_order,
    title: row.title,
    summary: row.summary,
  };
}

/** Names are stored lowercase; a host or a slug typed with capitals is the same name. */
export function normalizeExperienceName(name: string): string {
  return name.trim().toLowerCase();
}

export type ResolvedExperience = { experience: Experience; via: "slug" | "alias" };

/**
 * Finds a thing by its address or by any name it used to answer to.
 *
 * The live slug wins over an alias on purpose: an alias is a memory of an old
 * address, and the moment a real thing takes that address the memory is wrong.
 * (The trigger deletes such an alias; this order is the second lock.)
 *
 * `via` is returned because the two cases call for different HTTP answers — a
 * page reached through an alias should redirect to the live address rather than
 * render under the old one.
 */
export async function resolveExperience(db: Db, name: string): Promise<ResolvedExperience | null> {
  const key = normalizeExperienceName(name);
  if (!key) return null;

  const direct = await db.from("experiences").select(COLUMNS).eq("slug", key).maybeSingle();
  if (direct.error) throw new Error(`experience_read_failed:${direct.error.message}`);
  if (direct.data) return { experience: fromRow(direct.data as ExperienceRow), via: "slug" };

  const alias = await db.from("experience_aliases").select("experience_id").eq("alias", key).maybeSingle();
  if (alias.error) throw new Error(`experience_alias_read_failed:${alias.error.message}`);
  if (!alias.data) return null;

  const aliased = await db.from("experiences").select(COLUMNS).eq("id", alias.data.experience_id).maybeSingle();
  if (aliased.error) throw new Error(`experience_read_failed:${aliased.error.message}`);
  return aliased.data ? { experience: fromRow(aliased.data as ExperienceRow), via: "alias" } : null;
}

/** What stands on the public shelf, in the owner's order. */
export async function listShelf(
  db: Db,
  filter: { kinds?: readonly ExperienceKind[]; authorProfileId?: string } = {},
): Promise<Experience[]> {
  let query = db.from("experiences").select(COLUMNS).eq("listed", true);
  if (filter.kinds?.length) query = query.in("kind", [...filter.kinds]);
  if (filter.authorProfileId) query = query.eq("author_profile_id", filter.authorProfileId);
  const { data, error } = await query;
  if (error) throw new Error(`experience_shelf_read_failed:${error.message}`);
  /* Ordered here, not in the query: a thing with no place yet goes to the END
     of the shelf, and the address breaks ties so the order is never arbitrary. */
  return ((data ?? []) as ExperienceRow[])
    .map(fromRow)
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.POSITIVE_INFINITY) - (b.sortOrder ?? Number.POSITIVE_INFINITY) ||
        a.slug.localeCompare(b.slug),
    );
}

/**
 * Every name a new course may NOT take as its address.
 *
 * A course's `program_slug` becomes its thing's slug, and slugs are one
 * namespace across kinds — so `consult` and `herbs` are spoken for even though
 * no course carries them. The database refuses the collision anyway
 * (`experience_slug_taken`); this exists so the builder can step around the
 * name quietly, the way it already does for reserved route segments.
 *
 * Aliases are included for the same reason a forwarding address is not
 * re-let: a course created at `/programs/detox` would swallow the redirect that
 * old links depend on.
 */
export async function takenExperienceNames(db: Db): Promise<string[]> {
  const [things, aliases] = await Promise.all([
    db.from("experiences").select("slug"),
    db.from("experience_aliases").select("alias").eq("kind", "slug"),
  ]);
  if (things.error) throw new Error(`experience_names_read_failed:${things.error.message}`);
  if (aliases.error) throw new Error(`experience_names_read_failed:${aliases.error.message}`);
  return [
    ...((things.data ?? []) as { slug: string }[]).map((row) => row.slug),
    ...((aliases.data ?? []) as { alias: string }[]).map((row) => row.alias),
  ];
}
