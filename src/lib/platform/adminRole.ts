/**
 * Who counts as an admin, in one place.
 *
 * The predicate had been copy-pasted into `admin/layout.tsx` and `admin/page.tsx`,
 * and the header was about to make it three. Three copies of "who may see the
 * admin surface" is a security answer with three opinions.
 *
 * The role comes from `public.user_roles`, which is now the only role store.
 * A second one (`platform_users.role`) sat beside it until 2026-08-21, unsynced,
 * and writing to the wrong one was a silent no-op — the check simply never
 * matched and the surface stayed hidden with no error anywhere. It also carried
 * a self-elevation hole: `authenticated` could UPDATE that column on its own
 * row. It is gone; `resolveBuilderIdentity`, `isStaff` and
 * `/api/admin/bootstrap-role` all read this table.
 *
 * `support` is included deliberately — the admin shell already lets support in,
 * and a nav entry that leads somewhere you are allowed to be is the point.
 */

/** The roles that may open the admin surface. Lowercase; compare case-insensitively. */
export const ADMIN_ROLES = new Set(["admin", "support"]);

export function isAdminRole(role: string | null | undefined): boolean {
  if (typeof role !== "string") return false;
  return ADMIN_ROLES.has(role.trim().toLowerCase());
}

/**
 * Shared by the admin shell and the platform header so one fetch serves both.
 *
 * `_v2` because the entry stopped being just a role: it now also carries
 * whether the account authors a course, which is what decides the builder entry
 * in the app switcher. A surviving `_v1` entry would parse cleanly with that
 * field undefined, and an author would silently lose the link to their own tool
 * for the length of the TTL. Bumping the key makes the stale shape a miss.
 */
export const ADMIN_ROLE_CACHE_KEY = "cw_admin_role_cache_v2";
export const ADMIN_ROLE_CACHE_TTL_MS = 5 * 60_000;

/**
 * Staff — who may open a draft course. A wider set than admin: `coach` belongs
 * here and nowhere near the admin surface.
 *
 * Separate predicate, same table. The distinction being kept is "which
 * question", not "which store": `isStaff` answers "may see unpublished work",
 * `isAdminRole` answers "may open the panel". What is NOT kept is the old split
 * where those two questions were also answered by two different tables.
 */
export const STAFF_ROLES = new Set(["admin", "support", "coach"]);

export function isStaffRole(role: string | null | undefined): boolean {
  if (typeof role !== "string") return false;
  return STAFF_ROLES.has(role.trim().toLowerCase());
}
