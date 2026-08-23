/**
 * Access — one place that answers "who is learning what" and "who may do what".
 *
 * Until now both answers lived only in CLI scripts (`scripts/lms-grant.mjs`,
 * `scripts/admin-role.mjs`), which means every grant needed a laptop with the
 * service-role key in `.env.local`. This module is the same three operations
 * moved behind an admin session, so the panel can do them:
 *
 *   · course access  — a row in `lms_enrollments` with source='manual'
 *   · platform role  — a row in `user_roles` (the ONE role store since
 *                      2026-08-21; `platform_users.role` is gone)
 *   · builder access — `lms_courses.author_id`, per row, NOT a role. An
 *                      "author" role would say "may edit courses", not "may
 *                      edit THESE courses" (see the authorship migration).
 *
 * Every mutation here writes `audit_log`. Handing out access is exactly the
 * kind of act that must be attributable afterwards.
 *
 * Progress is folded in-process from the append-only event log rather than read
 * from a counter column, because no counter column exists — `foldProgress` is
 * the only definition of "done" this codebase has, and duplicating it in SQL
 * would give the panel a second opinion.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { writeCourseStructure } from "@/lib/lms/authoring";
import { validateCourse, type Course } from "@/lms-core";
import { foldProgress, type ProgressEvent, type ProgressEventType } from "@/lms-core/progress";
import { groupLearnersByAccount, learnerStatusOf } from "@/lib/admin/accessTypes";
import type {
    CourseRow,
    GrantableRole,
    LearnerAccountRow,
    LearnerRow,
    LearnerStatus,
    RoleRow,
} from "@/lib/admin/accessTypes";

export * from "@/lib/admin/accessTypes";

export type AccessAccount = {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
};

type Db = ReturnType<typeof adminClient>;

/**
 * Ceiling on how many enrollments one query folds.
 *
 * Progress cannot be filtered or sorted in SQL — it is a fold over events — so
 * a status filter has to load the matching set, fold it, then paginate in
 * memory. At the current scale (tens of enrollments) that is free; the cap is
 * what keeps it from silently becoming expensive later, and `truncated` in the
 * response is what keeps it from silently lying when it does.
 */
const FOLD_CEILING = 1000;

export class AccessError extends Error {
    constructor(message: string, readonly status: number = 400) {
        super(message);
        this.name = "AccessError";
    }
}

async function writeAudit(
    db: Db,
    entry: { actorId: string; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown> }
) {
    // Best-effort: an audit write that fails must not roll back a grant the
    // operator already saw succeed, but it must be visible in the server log.
    const { error } = await db.from("audit_log").insert({
        actor_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        metadata: entry.metadata,
    });
    if (error) console.error(`access: audit write failed for ${entry.action}`, error.message);
}

/** The account must have signed in once — that is what creates the platform_users row. */
export async function resolveAccountByEmail(db: Db, email: string): Promise<AccessAccount> {
    const trimmed = email.trim();
    if (!trimmed) throw new AccessError("email_required");

    const { data, error } = await db
        .from("platform_users")
        .select("auth_user_id, email, full_name, avatar_url")
        .ilike("email", trimmed)
        .maybeSingle();

    if (error) throw new AccessError(error.message, 500);
    if (!data) throw new AccessError("account_not_found");

    return {
        authUserId: data.auth_user_id,
        email: data.email,
        fullName: data.full_name,
        avatarUrl: data.avatar_url,
    };
}

async function accountsByIds(db: Db, ids: string[]): Promise<Map<string, AccessAccount>> {
    if (ids.length === 0) return new Map();
    const { data } = await db
        .from("platform_users")
        .select("auth_user_id, email, full_name, avatar_url")
        .in("auth_user_id", ids);

    return new Map(
        (data ?? []).map((row) => [
            row.auth_user_id as string,
            {
                authUserId: row.auth_user_id as string,
                email: row.email as string | null,
                fullName: row.full_name as string | null,
                avatarUrl: row.avatar_url as string | null,
            },
        ])
    );
}

async function lessonCountByCourse(db: Db, courseIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (courseIds.length === 0) return counts;

    const { data, error } = await db.from("lms_lessons").select("course_id").in("course_id", courseIds);
    if (error) throw new AccessError(error.message, 500);

    for (const row of data ?? []) {
        const key = row.course_id as string;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

async function progressByEnrollment(db: Db, enrollmentIds: string[]) {
    const folded = new Map<string, { completed: number; lastActivityAt: string | null }>();
    if (enrollmentIds.length === 0) return folded;

    const buckets = new Map<string, ProgressEvent[]>();
    // Supabase caps a single response at 1000 rows, so the event log is paged
    // explicitly — a half-read log would fold into a wrong, confident number.
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await db
            .from("lms_progress_events")
            .select("enrollment_id, client_id, type, lesson_id, payload, occurred_at")
            .in("enrollment_id", enrollmentIds)
            .order("occurred_at", { ascending: true })
            // `id` breaks ties: `occurred_at` alone is not a total order, and an
            // unstable sort across page boundaries silently loses events.
            .order("id", { ascending: true })
            .range(offset, offset + PAGE - 1);

        if (error) throw new AccessError(error.message, 500);
        for (const row of data ?? []) {
            const key = row.enrollment_id as string;
            const list = buckets.get(key) ?? [];
            list.push({
                clientId: row.client_id as string,
                type: row.type as ProgressEventType,
                lessonId: row.lesson_id as string,
                occurredAt: row.occurred_at as string,
                payload: (row.payload ?? {}) as ProgressEvent["payload"],
            });
            buckets.set(key, list);
        }
        if ((data?.length ?? 0) < PAGE) break;
    }

    for (const [enrollmentId, events] of buckets) {
        const progress = foldProgress(events);
        folded.set(enrollmentId, {
            completed: progress.completedLessonIds.length,
            lastActivityAt: progress.lastActivityAt,
        });
    }
    return folded;
}

/**
 * Makes a search string safe to interpolate into a PostgREST `or()` filter.
 *
 * `or()` parses its argument as a comma-separated list of `col.op.value`, so a
 * comma or paren in the raw query does not search for that character — it
 * changes which filters run. Stripping them narrows the search slightly and
 * removes the injection entirely. Dots stay: they are half of every email.
 */
export function sanitizeSearch(raw: string | undefined | null): string {
    return (raw ?? "").replace(/[,()*\\"']/g, " ").trim();
}

export type ListLearnersInput = {
    q?: string;
    courseSlug?: string;
    status?: LearnerStatus | "";
    limit: number;
    offset: number;
};

/**
 * Learners, one row per person rather than one per enrollment.
 *
 * The panel's question is "who is learning here", and a person holding three
 * courses is one person, not three learners — the flat list made the same
 * account appear three times and buried that they were the same human. So the
 * enrollment rows are folded by account before paging, which means the page
 * size counts people and the status filter asks "does this person have any
 * course in that state".
 *
 * The summary counts people the same way, so a tile's number is exactly what
 * clicking its tab shows. Tiles therefore do not add up to the total: someone
 * stalled on one course and finished on another is counted under both, which is
 * true of them.
 */
export async function listLearners(input: ListLearnersInput): Promise<{
    items: LearnerAccountRow[];
    total: number;
    truncated: boolean;
    summary: Record<LearnerStatus, number>;
}> {
    const db = adminClient();

    const { data: courseRows, error: courseError } = await db
        .from("lms_courses")
        .select("id, slug, title, status");
    if (courseError) throw new AccessError(courseError.message, 500);

    const courses = new Map((courseRows ?? []).map((row) => [row.id as string, row]));

    let query = db
        .from("lms_enrollments")
        .select("id, course_id, auth_user_id, source, order_ref, started_at, expires_at")
        .order("started_at", { ascending: false })
        // One past the ceiling on purpose: the extra row is the signal that
        // there was more, which is what `truncated` reports.
        .range(0, FOLD_CEILING);

    if (input.courseSlug) {
        const course = (courseRows ?? []).find((row) => row.slug === input.courseSlug);
        if (!course) throw new AccessError("course_not_found", 404);
        query = query.eq("course_id", course.id);
    }

    const q = sanitizeSearch(input.q);
    if (q) {
        // The searchable text (email, name) lives on platform_users, so the
        // search resolves accounts first and filters enrollments by their ids.
        const { data: matches, error: matchError } = await db
            .from("platform_users")
            .select("auth_user_id")
            .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
            .limit(FOLD_CEILING);
        if (matchError) throw new AccessError(matchError.message, 500);

        const ids = (matches ?? []).map((row) => row.auth_user_id as string);
        if (ids.length === 0) {
            return { items: [], total: 0, truncated: false, summary: emptySummary() };
        }
        query = query.in("auth_user_id", ids);
    }

    const { data: enrollments, error } = await query;
    if (error) throw new AccessError(error.message, 500);

    const rows = enrollments ?? [];
    const truncated = rows.length > FOLD_CEILING;
    const bounded = truncated ? rows.slice(0, FOLD_CEILING) : rows;

    const [accounts, lessonCounts, progress] = await Promise.all([
        accountsByIds(db, [...new Set(bounded.map((row) => row.auth_user_id as string))]),
        lessonCountByCourse(db, [...new Set(bounded.map((row) => row.course_id as string))]),
        progressByEnrollment(db, bounded.map((row) => row.id as string)),
    ]);

    const all: LearnerRow[] = bounded.map((row) => {
        const course = courses.get(row.course_id as string);
        const account = accounts.get(row.auth_user_id as string);
        const folded = progress.get(row.id as string) ?? { completed: 0, lastActivityAt: null };
        const lessonsTotal = lessonCounts.get(row.course_id as string) ?? 0;

        return {
            enrollmentId: row.id as string,
            courseId: row.course_id as string,
            courseSlug: (course?.slug as string) ?? "—",
            courseTitle: (course?.title as string) ?? "—",
            courseStatus: (course?.status as string) ?? "—",
            authUserId: row.auth_user_id as string,
            email: account?.email ?? null,
            fullName: account?.fullName ?? null,
            avatarUrl: account?.avatarUrl ?? null,
            source: row.source as string,
            orderRef: (row.order_ref as string | null) ?? null,
            startedAt: row.started_at as string,
            expiresAt: (row.expires_at as string | null) ?? null,
            lessonsTotal,
            lessonsCompleted: folded.completed,
            lastActivityAt: folded.lastActivityAt,
            status: learnerStatusOf(lessonsTotal, folded.completed, folded.lastActivityAt),
        };
    });

    const people = groupLearnersByAccount(all);

    const summary = emptySummary();
    for (const person of people) {
        for (const status of new Set(person.courses.map((course) => course.status))) summary[status] += 1;
    }

    const filtered = input.status
        ? people.filter((person) => person.courses.some((course) => course.status === input.status))
        : people;
    const page = filtered.slice(input.offset, input.offset + input.limit);

    return { items: page, total: filtered.length, truncated, summary };
}

function emptySummary(): Record<LearnerStatus, number> {
    return { not_started: 0, in_progress: 0, stalled: 0, completed: 0 };
}

export async function grantCourse(input: { email: string; courseSlug: string; actorId: string }) {
    const db = adminClient();
    const account = await resolveAccountByEmail(db, input.email);

    const { data: course, error: courseError } = await db
        .from("lms_courses")
        .select("id, slug, title, status")
        .eq("slug", input.courseSlug)
        .maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    const { data: existing } = await db
        .from("lms_enrollments")
        .select("id, source, started_at")
        .eq("course_id", course.id)
        .eq("auth_user_id", account.authUserId)
        .maybeSingle();

    if (existing) {
        // Already enrolled is success, not an error — the operator's intent
        // ("this person can open the course") is already true.
        return { created: false, course, account, enrollmentId: existing.id as string };
    }

    const { data: inserted, error } = await db
        .from("lms_enrollments")
        .insert({
            course_id: course.id,
            auth_user_id: account.authUserId,
            source: "manual",
            // Day 1 starts now — same rule as `scripts/lms-grant.mjs`.
            started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.grant",
        entityType: "lms_enrollment",
        entityId: inserted.id as string,
        metadata: {
            course_slug: course.slug,
            course_status: course.status,
            grantee_email: account.email,
            grantee_auth_user_id: account.authUserId,
            source: "manual",
        },
    });

    return { created: true, course, account, enrollmentId: inserted.id as string };
}

/**
 * Revoke is a real reset: `lms_progress_events` cascades with the enrollment,
 * so the learner loses their history, not just the door. The UI says so.
 */
export async function revokeCourse(input: { enrollmentId: string; actorId: string }) {
    const db = adminClient();

    const { data: enrollment, error: readError } = await db
        .from("lms_enrollments")
        .select("id, course_id, auth_user_id, source, started_at")
        .eq("id", input.enrollmentId)
        .maybeSingle();
    if (readError) throw new AccessError(readError.message, 500);
    if (!enrollment) throw new AccessError("enrollment_not_found", 404);

    const { data: course } = await db
        .from("lms_courses")
        .select("slug")
        .eq("id", enrollment.course_id)
        .maybeSingle();
    const { data: account } = await db
        .from("platform_users")
        .select("email")
        .eq("auth_user_id", enrollment.auth_user_id)
        .maybeSingle();
    const { count: eventCount } = await db
        .from("lms_progress_events")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollment.id);

    const { error } = await db.from("lms_enrollments").delete().eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.revoke",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: course?.slug ?? null,
            grantee_email: account?.email ?? null,
            grantee_auth_user_id: enrollment.auth_user_id,
            source: enrollment.source,
            // Recorded because the deletion is not recoverable from this table.
            progress_events_deleted: eventCount ?? 0,
        },
    });

    return { courseSlug: course?.slug ?? null, email: account?.email ?? null, progressEventsDeleted: eventCount ?? 0 };
}

export async function listRoles(input: { q?: string }): Promise<RoleRow[]> {
    const db = adminClient();

    const { data: roles, error } = await db
        .from("user_roles")
        .select("user_id, role, updated_at")
        .order("updated_at", { ascending: false });
    if (error) throw new AccessError(error.message, 500);

    // Only elevated roles are worth a table — 'user' is everyone, and listing
    // everyone here would just be a worse version of /admin/customers.
    const elevated = (roles ?? []).filter((row) => String(row.role).toLowerCase() !== "user");
    if (elevated.length === 0) return [];
    const ids = elevated.map((row) => row.user_id as string);

    const [{ data: profiles }, { data: owned }, { data: enrolled }] = await Promise.all([
        db
            .from("platform_users")
            .select("auth_user_id, email, full_name, avatar_url, last_sign_in_at")
            .in("auth_user_id", ids),
        db.from("lms_courses").select("author_id").not("author_id", "is", null),
        db.from("lms_enrollments").select("auth_user_id").in("auth_user_id", ids),
    ]);

    const profileById = new Map((profiles ?? []).map((row) => [row.auth_user_id as string, row]));
    const ownedCount = new Map<string, number>();
    for (const row of owned ?? []) {
        const key = row.author_id as string;
        ownedCount.set(key, (ownedCount.get(key) ?? 0) + 1);
    }
    const enrolledCount = new Map<string, number>();
    for (const row of enrolled ?? []) {
        const key = row.auth_user_id as string;
        enrolledCount.set(key, (enrolledCount.get(key) ?? 0) + 1);
    }

    const q = input.q?.trim().toLowerCase() ?? "";
    return elevated
        .map((row) => {
            const profile = profileById.get(row.user_id as string);
            return {
                authUserId: row.user_id as string,
                email: (profile?.email as string | null) ?? null,
                fullName: (profile?.full_name as string | null) ?? null,
                avatarUrl: (profile?.avatar_url as string | null) ?? null,
                role: String(row.role).toLowerCase(),
                lastSignInAt: (profile?.last_sign_in_at as string | null) ?? null,
                updatedAt: (row.updated_at as string | null) ?? null,
                ownedCourses: ownedCount.get(row.user_id as string) ?? 0,
                enrollments: enrolledCount.get(row.user_id as string) ?? 0,
            } satisfies RoleRow;
        })
        .filter((row) =>
            q ? `${row.email ?? ""} ${row.fullName ?? ""}`.toLowerCase().includes(q) : true
        );
}

export async function setRole(input: { email: string; role: GrantableRole; actorId: string }) {
    const db = adminClient();
    const account = await resolveAccountByEmail(db, input.email);

    if (account.authUserId === input.actorId) {
        // A panel that can demote its own operator can lock the last admin out
        // of the panel. Changing your own role stays a deliberate CLI act.
        throw new AccessError("cannot_change_own_role", 409);
    }

    const { data: current } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", account.authUserId)
        .maybeSingle();
    const previous = current?.role ? String(current.role).toLowerCase() : null;

    const { error } = await db
        .from("user_roles")
        .upsert(
            { user_id: account.authUserId, role: input.role, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
        );
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.role.set",
        entityType: "user_role",
        entityId: account.authUserId,
        metadata: {
            grantee_email: account.email,
            role_before: previous,
            role_after: input.role,
        },
    });

    return { account, previous, role: input.role };
}

export async function listCourses(): Promise<CourseRow[]> {
    const db = adminClient();

    const { data: courses, error } = await db
        .from("lms_courses")
        .select("*")
        .order("updated_at", { ascending: false });
    if (error) throw new AccessError(error.message, 500);

    const authorIds = [...new Set((courses ?? []).map((row) => row.author_id as string | null).filter((id): id is string => Boolean(id)))];
    const [authors, { data: enrollments }] = await Promise.all([
        accountsByIds(db, authorIds),
        db.from("lms_enrollments").select("course_id"),
    ]);

    const learners = new Map<string, number>();
    for (const row of enrollments ?? []) {
        const key = row.course_id as string;
        learners.set(key, (learners.get(key) ?? 0) + 1);
    }

    return (courses ?? []).map((row) => {
        const author = row.author_id ? authors.get(row.author_id as string) : undefined;
        return {
            id: row.id as string,
            slug: row.slug as string,
            title: row.title as string,
            status: row.status as string,
            reviewStatus: row.pending_content
                ? ((row.pending_review_status as CourseRow["reviewStatus"] | undefined) ?? "draft")
                : ((row.review_status as CourseRow["reviewStatus"] | undefined) ?? (row.status === "published" ? "approved" : "draft")),
            reviewNote: row.pending_content
                ? ((row.pending_review_note as string | null) ?? null)
                : ((row.review_note as string | null) ?? null),
            reviewEnabled: "review_status" in row,
            hasPendingRevision: Boolean(row.pending_content),
            visibility: (row.visibility as CourseRow["visibility"] | undefined) ?? "hidden",
            locale: row.locale as string,
            brand: row.brand as string,
            authorId: (row.author_id as string | null) ?? null,
            authorEmail: author?.email ?? null,
            authorName: author?.fullName ?? null,
            learners: learners.get(row.id as string) ?? 0,
            updatedAt: row.updated_at as string,
        } satisfies CourseRow;
    });
}

export async function moderateCourse(input: {
    courseId: string;
    actorId: string;
    action: "approve" | "request_changes" | "set_visibility";
    note?: string;
    visibility?: CourseRow["visibility"];
}) {
    const db = adminClient();
    const { data: course, error: readError } = await db.from("lms_courses")
        .select("*").eq("id", input.courseId).maybeSingle();
    if (readError) throw new AccessError(readError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    let values: Record<string, unknown>;
    const hasPendingRevision = Boolean(course.pending_content);
    const reviewStatus = hasPendingRevision ? course.pending_review_status : course.review_status;
    if (input.action === "approve") {
        if (reviewStatus !== "in_review") throw new AccessError("course_not_in_review", 409);
        if (hasPendingRevision) {
            try {
                validateCourse(course.pending_content, "pending_revision");
            } catch (error) {
                throw new AccessError(error instanceof Error ? error.message : "course_revision_invalid", 422);
            }
            const revision = course.pending_content as Course;
            const writer = db as unknown as Parameters<typeof writeCourseStructure>[0];
            await writeCourseStructure(writer, {
                ...revision,
                id: course.id as string,
                slug: course.slug as string,
                status: "published",
                visibility: course.visibility ?? "hidden",
                version: Number(course.version ?? revision.version) + 1,
            });
            values = {
                review_status: "approved", review_note: null, approved_at: new Date().toISOString(), approved_by: input.actorId,
                pending_content: null, pending_review_status: null, pending_review_note: null, pending_submitted_at: null, pending_updated_at: null,
            };
        } else {
            values = { review_status: "approved", review_note: null, approved_at: new Date().toISOString(), approved_by: input.actorId };
        }
    } else if (input.action === "request_changes") {
        if (reviewStatus !== "in_review") throw new AccessError("course_not_in_review", 409);
        values = hasPendingRevision
            ? { pending_review_status: "changes_requested", pending_review_note: input.note?.trim() || "Потрібні зміни" }
            : { review_status: "changes_requested", review_note: input.note?.trim() || "Потрібні зміни", approved_at: null, approved_by: null };
    } else {
        if (!input.visibility || !["hidden", "unlisted", "listed"].includes(input.visibility)) throw new AccessError("invalid_visibility", 400);
        if (input.visibility !== "hidden" && (course.status !== "published" || course.review_status !== "approved")) {
            throw new AccessError("course_not_ready_for_storefront", 409);
        }
        values = { visibility: input.visibility };
    }
    const { error } = await db.from("lms_courses").update(values).eq("id", input.courseId);
    if (error) throw new AccessError(error.message, 500);
    await writeAudit(db, { actorId: input.actorId, action: `course.${input.action}`, entityType: "lms_course", entityId: input.courseId, metadata: { slug: course.slug, ...values } });
    return { id: input.courseId, slug: course.slug as string, ...values };
}

/**
 * Hand a course to an author, or take it back to the house (`email: null`).
 *
 * This is the whole of "builder access": `canEditCourse` reads `author_id`, and
 * `canCreateCourse` lets anyone who already owns one course create more. So the
 * first assignment is the deliberate act that makes someone an author — which
 * is why it is admin-only and audited.
 */
export async function setCourseAuthor(input: { courseId: string; email: string | null; actorId: string }) {
    const db = adminClient();

    const { data: course, error: courseError } = await db
        .from("lms_courses")
        .select("id, slug, title, author_id")
        .eq("id", input.courseId)
        .maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    const account = input.email ? await resolveAccountByEmail(db, input.email) : null;
    // Captured before the write, so the audit entry says what was replaced.
    const authorBefore = (course.author_id as string | null) ?? null;

    const { error } = await db
        .from("lms_courses")
        .update({ author_id: account?.authUserId ?? null })
        .eq("id", course.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: account ? "access.course.author_set" : "access.course.author_cleared",
        entityType: "lms_course",
        entityId: course.id as string,
        metadata: {
            course_slug: course.slug,
            author_before: authorBefore,
            author_after: account?.authUserId ?? null,
            author_email: account?.email ?? null,
        },
    });

    return { course, account };
}
