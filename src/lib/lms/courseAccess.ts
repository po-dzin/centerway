/**
 * One place that answers "who is calling, and may they touch this course?".
 *
 * WHY IT EXISTS. Until now every authoring route opened with the same twelve
 * lines — `requireUserFromBearer`, `resolveBuilderIdentity`, load the course,
 * `canEditCourse`, 401 or 404 — repeated across eleven route files, while the
 * services underneath (`loadBuilderCourse`, `saveBuilderCourse`) check nothing.
 * That works as long as the only caller is a route, because a route file is
 * where a reviewer looks for the check.
 *
 * The agent contour breaks that assumption (docs/agent-contour-2026-08-21.md,
 * инвариант 2). A tool is a FUNCTION, not an HTTP route: it will call the same
 * services from inside a chat endpoint, and it would have been the twelfth
 * place to repeat the dance — the first one where forgetting is easy and the
 * only one where forgetting hands a stranger's course to a language model. So
 * the check moves out of the route preamble and becomes callable from both.
 *
 * TWO ENTRY POINTS, ONE DECISION:
 *
 *   · `resolveCourseAccess(user, slug)` — no HTTP anywhere in it. This is what
 *     an agent tool calls, with the user it was handed.
 *   · `withCourseAccess(req, slug, run)` — the route wrapper around it, which
 *     turns a denial into the response the builder already expects.
 *
 * 404, NOT 403, for a course this identity may not edit: whether a course
 * exists is not information an unauthorised caller is owed. That rule was
 * already true in every route; it is now true in one place.
 *
 * THE GRANT DOES NOT CARRY THE COURSE. It carries `load()`. Access is decided
 * from ownership columns alone (`readCourseOwnership`), so a stored course that
 * fails validation is still ACCESSIBLE to its author — they get a 422 naming
 * the broken field from their own `load()`, inside their own try block, rather
 * than a 404 telling them the course they are looking at does not exist.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { enforceRateLimit, tooManyRequests, type RateLimitRule } from "@/lib/rateLimit";
import { loadBuilderCourse, readCourseOwnership } from "./builder";
import { canEditCourse, resolveBuilderIdentity, type BuilderIdentity } from "./builderAccess";

type LoadedCourse = NonNullable<Awaited<ReturnType<typeof loadBuilderCourse>>>;

export type CourseGrant = {
  identity: BuilderIdentity;
  courseId: string;
  slug: string;
  authorId: string | null;
  /**
   * The full course, rebuilt on demand. Throws `lms_*` for stored content that
   * no longer validates — the caller maps that to 422, the same way it always
   * did. Never returns null: existence was settled before the grant was issued.
   */
  load: () => Promise<LoadedCourse>;
};

export type AccessDenial = { denied: "unauthenticated" | "not_found" };

export type CourseAccess = { grant: CourseGrant } | AccessDenial;

/** True for the denial half of a `CourseAccess`, narrowing the union. */
export function isDenied(access: CourseAccess | { identity: BuilderIdentity } | AccessDenial): access is AccessDenial {
  return "denied" in access;
}

/**
 * The decision, with no transport attached.
 *
 * `user` is whatever proved the identity — a Supabase user from a Bearer token
 * in a route, the same object carried by an agent session in a tool. What it is
 * NOT is anything the model produced: a tool receives the user from the server
 * that authenticated it, never from its own arguments.
 */
export async function resolveCourseAccess(
  user: { id: string; email?: string | null } | null,
  slug: string
): Promise<CourseAccess> {
  if (!user) return { denied: "unauthenticated" };
  return resolveCourseAccessForIdentity(await resolveBuilderIdentity(user), slug);
}

/**
 * The same decision for a caller that already resolved its identity.
 *
 * The media route needs this split: its slug arrives inside a multipart body,
 * so it has to authenticate BEFORE parsing — otherwise a stranger's twenty
 * megabytes get decoded into a function's heap before anyone asks who they are.
 */
export async function resolveCourseAccessForIdentity(
  identity: BuilderIdentity,
  slug: string
): Promise<CourseAccess> {
  const owned = await readCourseOwnership(slug);
  if (!owned || !canEditCourse(identity, owned.authorId)) return { denied: "not_found" };

  return {
    grant: {
      identity,
      courseId: owned.id,
      slug: owned.slug,
      authorId: owned.authorId,
      load: async () => {
        const loaded = await loadBuilderCourse(slug);
        // Between the ownership read and this one the row could in principle be
        // gone. Answering with the same 404 the access check would have given
        // keeps one story instead of a null nobody upstream expects.
        if (!loaded) throw new Error("lms_builder_course_vanished");
        return loaded;
      },
    },
  };
}

/** The identity alone, for the routes that operate on the shelf rather than one course. */
export async function resolveIdentityFromRequest(
  req: NextRequest
): Promise<{ identity: BuilderIdentity } | AccessDenial> {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return { denied: "unauthenticated" };
  return { identity: await resolveBuilderIdentity(user) };
}

export function denialResponse(denial: AccessDenial): NextResponse {
  return denial.denied === "unauthenticated"
    ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
    : NextResponse.json({ error: "course_not_found" }, { status: 404 });
}

/**
 * Everything a mutating authoring route needs before its own work starts:
 * identity, permission, and the rate limit that goes with the surface.
 *
 * The limit is applied AFTER authentication and keyed by user id, not by IP.
 * An author on a shared address is not a stranger, and a signed-in caller is
 * the unit that costs us something — which is the unit an agent will be too.
 */
export async function withCourseAccess(
  req: NextRequest,
  slug: string,
  run: (grant: CourseGrant) => Promise<NextResponse>,
  rule?: RateLimitRule
): Promise<NextResponse> {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  const access = await resolveCourseAccess(user, slug);
  if (isDenied(access)) return denialResponse(access);

  if (rule) {
    const limit = await enforceRateLimit(req, rule, access.grant.identity.authUserId);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  }

  return run(access.grant);
}

/** The same wrapper for routes that have no slug: the course list, import, media. */
export async function withBuilderIdentity(
  req: NextRequest,
  run: (identity: BuilderIdentity) => Promise<NextResponse>,
  rule?: RateLimitRule
): Promise<NextResponse> {
  const access = await resolveIdentityFromRequest(req);
  if (isDenied(access)) return denialResponse(access);

  if (rule) {
    const limit = await enforceRateLimit(req, rule, access.identity.authUserId);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);
  }

  return run(access.identity);
}
