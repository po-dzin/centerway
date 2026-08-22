/**
 * Who may edit which course.
 *
 * Ownership is per row (`lms_courses.author_id`), not per role — the reasoning
 * is in commit d87daba: "author" as a global role says "may edit courses", not
 * "may edit THESE courses", which is exactly wrong the moment a second author
 * exists. So the row carries it.
 *
 * Two things a role IS still the right shape for, and both stay with admin:
 * creating a course shell that has no owner yet, and editing a course whose
 * `author_id` is NULL — the state both existing courses are in, meaning
 * "managed by the house".
 *
 * The admin check reads `public.user_roles` — the table `get_my_role()` reads.
 * There used to be a second, unsynchronised store (`platform_users.role`) and
 * picking the wrong one was a silent no-op; that column was retired 2026-08-21
 * (docs/migration/sql/2026-08-21_merge_role_stores.sql).
 */

import { adminClient } from "@/lib/auth/adminClient";
import { isAdminRole } from "@/lib/platform/adminRole";

export type BuilderIdentity = {
  authUserId: string;
  email: string | null;
  isAdmin: boolean;
};

export async function resolveBuilderIdentity(user: {
  id: string;
  email?: string | null;
}): Promise<BuilderIdentity> {
  const db = adminClient();
  const { data } = await db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();

  return {
    authUserId: user.id,
    email: user.email ?? null,
    isAdmin: isAdminRole(data?.role),
  };
}

/**
 * True when this identity may open and write this course.
 *
 * `authorId === null` means house-managed, and only an admin may touch it —
 * NOT "anyone", which is what a plain `authorId !== identity.id` check would
 * have implied for the two courses that exist today.
 */
export function canEditCourse(identity: BuilderIdentity, authorId: string | null): boolean {
  if (identity.isAdmin) return true;
  return authorId !== null && authorId === identity.authUserId;
}

/** Courses this identity may see in the builder's list. */
export function courseFilterFor(identity: BuilderIdentity): { authorId?: string } {
  return identity.isAdmin ? {} : { authorId: identity.authUserId };
}

/**
 * True when this identity may create a course from nothing.
 *
 * NOT "anyone who is signed in". The builder answers on a public host and its
 * sign-in is plain Google OAuth, so every person on the internet can reach an
 * authenticated session here; a bare `user !== null` check would make "create
 * a course" a public endpoint that writes rows.
 *
 * Two who may: an admin, and someone who already owns a course. The second is
 * the rule that keeps ownership per-row while still letting a real author work
 * — an author is a person the house has already handed something to, and
 * handing them the first course is the deliberate act that makes them one.
 */
export function canCreateCourse(identity: BuilderIdentity, ownedCourseCount: number): boolean {
  return identity.isAdmin || ownedCourseCount > 0;
}
