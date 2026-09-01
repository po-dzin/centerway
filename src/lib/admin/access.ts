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
 * Since 2026-08-26 it also carries the hand-made sale, for money that arrives
 * outside the payment provider — a transfer, cash, a partner invoice:
 *
 *   · the person       — an account for an email that has never signed in, so a
 *                        buyer is not told to log in first and call back
 *   · the payment      — a paid `orders` row, because entitlement, the profile
 *                        and every revenue report read orders, not enrollments
 *   · the deadline     — `lms_enrollments.expires_at`, per person per course
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
import {
    accessRuleOf,
    accessStateOf,
    accessWindowEnd,
    courseOfferCode,
    daysRemaining,
    validateCourse,
    type Course,
} from "@/lms-core";
import { foldProgress, type ProgressEvent, type ProgressEventType } from "@/lms-core/progress";
import { ELEVATED_ROLES, groupLearnersByAccount, learnerStatusOf, type AccessFacet, type GrantSource, type PersonRow } from "@/lib/admin/accessTypes";
import type {
    AuthorProfileRow,
    CourseRow,
    GrantableRole,
    PaymentCurrency,
    LearnerAccountRow,
    LearnerRow,
    LearnerStatus,
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

/** Exported so the catalogue writes its offer changes into the same log. */
export async function writeAudit(
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

/* `listLearners` and `listAccounts` were merged into `listPeople` above.
 * They were the same list seen from two ends — enrollments-first, so an
 * account holding no course was invisible; accounts-first, so what they held
 * was not there. Step 2 of docs/admin-access-shape-2026-08-28.md. */

async function foldEnrollmentsByAccount(
    db: Db,
    authUserIds: string[],
    courseSlug?: string
): Promise<Map<string, LearnerAccountRow>> {
    if (authUserIds.length === 0) return new Map();

    const { data: courseRows, error: courseError } = await db.from("lms_courses").select("id, slug, title, status");
    if (courseError) throw new AccessError(courseError.message, 500);

    const courses = new Map((courseRows ?? []).map((row) => [row.id as string, row]));

    let query = db
        .from("lms_enrollments")
        .select(
            "id, course_id, auth_user_id, source, order_ref, started_at, expires_at, status, revoked_at, blocked_at, blocked_reason"
        )
        .in("auth_user_id", authUserIds)
        .order("started_at", { ascending: false })
        .range(0, FOLD_CEILING);

    if (courseSlug) {
        const course = (courseRows ?? []).find((row) => row.slug === courseSlug);
        if (!course) throw new AccessError("course_not_found", 404);
        query = query.eq("course_id", course.id);
    }

    const { data: enrollments, error } = await query;
    if (error) throw new AccessError(error.message, 500);

    const rows = enrollments ?? [];
    if (rows.length === 0) return new Map();

    const [accounts, lessonCounts, progress] = await Promise.all([
        accountsByIds(db, [...new Set(rows.map((row) => row.auth_user_id as string))]),
        lessonCountByCourse(db, [...new Set(rows.map((row) => row.course_id as string))]),
        progressByEnrollment(db, rows.map((row) => row.id as string)),
    ]);

    const now = new Date();
    const all: LearnerRow[] = rows.map((row) => {
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
            // The panel's own answer to "can they open it right now", folded
            // from the same rule the learner's door uses — a deadline that has
            // passed reads as closed here without any sweep having run.
            access: accessStateOf(
                {
                    status: row.status as string | null,
                    blockedAt: (row.blocked_at as string | null) ?? null,
                    expiresAt: (row.expires_at as string | null) ?? null,
                },
                now
            ),
            daysLeft: daysRemaining((row.expires_at as string | null) ?? null, now),
            blockedReason: (row.blocked_reason as string | null) ?? null,
            lessonsTotal,
            lessonsCompleted: folded.completed,
            lastActivityAt: folded.lastActivityAt,
            status: learnerStatusOf(lessonsTotal, folded.completed, folded.lastActivityAt),
        };
    });

    return new Map(groupLearnersByAccount(all).map((person) => [person.authUserId, person]));
}

export type ListPeopleInput = {
    q?: string;
    /** A role to narrow to, or `staff` for any elevated one. */
    role?: string;
    /** Whether to show everybody, only people holding a course, or only people holding none. */
    access?: AccessFacet;
    courseSlug?: string;
    status?: LearnerStatus | "";
    limit: number;
    offset: number;
};

/**
 * One person per row, with everything the panel knows about them.
 *
 * THIS IS THE MERGE OF TWO LISTS THAT WERE ONE LIST. `listLearners` started
 * from enrollments and so could not see an account that held none;
 * `listAccounts` started from accounts and so could not show what they held.
 * The panel then had a tab for each, and "holds a course" — an attribute of a
 * person — wore a tab instead of a facet. Step 2 of
 * docs/admin-access-shape-2026-08-28.md.
 *
 * IT PAGES IN MEMORY, and that is not laziness. Status is a fold over the event
 * log (`foldProgress` is the only definition of "done" this codebase has), so
 * it cannot be a WHERE clause: filtering or counting by it means loading the
 * candidates, folding them, and only then slicing. `listLearners` already made
 * that trade; this keeps its ceiling and its `truncated` flag, which is what
 * stops the trade from silently becoming a lie.
 */
export async function listPeople(input: ListPeopleInput): Promise<{
    items: PersonRow[];
    total: number;
    truncated: boolean;
    summary: Record<LearnerStatus, number>;
}> {
    const db = adminClient();

    // ── 1. The candidate people ────────────────────────────────────────────
    let accountQuery = db
        .from("platform_users")
        .select("auth_user_id, email, full_name, avatar_url, provider, last_sign_in_at")
        .order("last_sign_in_at", { ascending: false, nullsFirst: false })
        .limit(FOLD_CEILING + 1);

    const q = sanitizeSearch(input.q);
    if (q) accountQuery = accountQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

    if (input.role) {
        const wanted = input.role === "staff" ? ELEVATED_ROLES : [input.role];
        const { data: holders, error: roleError } = await db.from("user_roles").select("user_id").in("role", wanted);
        if (roleError) throw new AccessError(roleError.message, 500);

        const ids = (holders ?? []).map((row) => row.user_id as string);
        // An empty `in()` is a query Postgres rejects; nobody holding the role
        // is an empty page, not an error.
        if (ids.length === 0) return { items: [], total: 0, truncated: false, summary: emptySummary() };
        accountQuery = accountQuery.in("auth_user_id", ids);
    }

    const { data: accountRows, error: accountError } = await accountQuery;
    if (accountError) throw new AccessError(accountError.message, 500);

    const accounts = accountRows ?? [];
    const truncated = accounts.length > FOLD_CEILING;
    const bounded = truncated ? accounts.slice(0, FOLD_CEILING) : accounts;
    if (bounded.length === 0) return { items: [], total: 0, truncated, summary: emptySummary() };

    const ids = bounded.map((row) => row.auth_user_id as string);

    // ── 2. What they hold ──────────────────────────────────────────────────
    const coursesByAccount = await foldEnrollmentsByAccount(db, ids, input.courseSlug);

    // ── 3. What they are ───────────────────────────────────────────────────
    const [{ data: roles }, { data: owned }, customerIdByAccount] = await Promise.all([
        db.from("user_roles").select("user_id, role, updated_at").in("user_id", ids),
        db.from("lms_courses").select("author_id").not("author_id", "is", null),
        customersByAccount(
            db,
            bounded.map((row) => ({ authUserId: row.auth_user_id as string, email: (row.email as string | null) ?? null }))
        ),
    ]);

    const roleById = new Map((roles ?? []).map((row) => [row.user_id as string, String(row.role).toLowerCase()]));
    const roleUpdatedById = new Map((roles ?? []).map((row) => [row.user_id as string, (row.updated_at as string | null) ?? null]));

    const ownedByAuthor = new Map<string, number>();
    for (const row of owned ?? []) {
        const key = row.author_id as string;
        ownedByAuthor.set(key, (ownedByAuthor.get(key) ?? 0) + 1);
    }

    const paidByCustomer = await paidOrderCounts(db, [...new Set([...customerIdByAccount.values()].flat())]);

    const people: PersonRow[] = bounded.map((row) => {
        const authUserId = row.auth_user_id as string;
        const held = coursesByAccount.get(authUserId);
        const customers = customerIdByAccount.get(authUserId) ?? [];

        return {
            authUserId,
            email: (row.email as string | null) ?? null,
            fullName: (row.full_name as string | null) ?? null,
            avatarUrl: (row.avatar_url as string | null) ?? null,
            courses: held?.courses ?? [],
            lessonsTotal: held?.lessonsTotal ?? 0,
            lessonsCompleted: held?.lessonsCompleted ?? 0,
            lastActivityAt: held?.lastActivityAt ?? null,
            status: held?.status ?? "not_started",
            provider: (row.provider as string | null) ?? null,
            lastSignInAt: (row.last_sign_in_at as string | null) ?? null,
            role: roleById.get(authUserId) ?? null,
            roleUpdatedAt: roleUpdatedById.get(authUserId) ?? null,
            purchases: customers.reduce((sum, id) => sum + (paidByCustomer.get(id) ?? 0), 0),
            ownedCourses: ownedByAuthor.get(authUserId) ?? 0,
        };
    });

    // ── 4. The facets ──────────────────────────────────────────────────────
    // The summary counts what the OTHER facets left, before the status facet
    // narrows it: the numbers are what you are choosing between, so a chosen
    // status must not rewrite them to itself.
    const scoped = people.filter((person) => {
        // Asking about one course means asking about the people in it. Without
        // this, somebody whose only enrollment is a different course would
        // survive with an empty `courses` and read as "has no courses".
        if (input.courseSlug && person.courses.length === 0) return false;
        if (input.access === "enrolled") return person.courses.length > 0;
        if (input.access === "none") return person.courses.length === 0;
        return true;
    });

    const summary = emptySummary();
    for (const person of scoped) {
        for (const status of new Set(person.courses.map((course) => course.status))) summary[status] += 1;
    }

    const filtered = input.status
        ? scoped.filter((person) => person.courses.some((course) => course.status === input.status))
        : scoped;

    return {
        items: filtered.slice(input.offset, input.offset + input.limit),
        total: filtered.length,
        truncated,
        summary,
    };
}

function emptySummary(): Record<LearnerStatus, number> {
    return { not_started: 0, in_progress: 0, stalled: 0, completed: 0 };
}

export async function grantCourse(input: {
    email: string;
    courseSlug: string;
    actorId: string;
    /** ISO instant, already normalized by the caller. `null`/absent means access does not end. */
    expiresAt?: string | null;
    /** Why this seat exists. Defaults to a plain admin grant. */
    source?: GrantSource;
    /**
     * The purchase this seat was opened for, when there is one.
     *
     * Without it a hand-recorded sale left the seat with no anchor, and the
     * learner's first visit read the manual order as a purchase nobody had
     * counted yet: `planAccess` then stacked the offer's term on top of the
     * date the operator typed, or replaced it with "forever" on a lifetime
     * offer. Naming the order here makes it already spent, so the window the
     * operator agreed is the window that stands.
     */
    orderRef?: string | null;
}) {
    const db = adminClient();
    const account = await resolveAccountByEmail(db, input.email);

    const { data: course, error: courseError } = await db
        .from("lms_courses")
        .select("id, slug, title, status")
        .eq("slug", input.courseSlug)
        .maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    const expiresAt = input.expiresAt ?? null;

    const source: GrantSource = input.source ?? "manual";

    const { data: existing } = await db
        .from("lms_enrollments")
        .select("id, source, started_at, expires_at, status, blocked_at")
        .eq("course_id", course.id)
        .eq("auth_user_id", account.authUserId)
        .maybeSingle();

    if (existing) {
        // A revoked seat is re-opened by the grant: the operator is saying "this
        // person can open the course", and a stale `revoked` would keep the door
        // shut behind their back. A BAN is not lifted here — that stays a
        // separate, deliberate act (`unblockCourse`).
        if (existing.blocked_at) throw new AccessError("enrollment_blocked", 409);
        if (existing.status === "revoked") {
            await reactivateCourse({ enrollmentId: existing.id as string, actorId: input.actorId });
        }

        // Already enrolled is success, not an error — the operator's intent
        // ("this person can open the course") is already true. A deadline
        // typed alongside the grant is still applied: the operator asked for
        // access *until this date*, and half of that request is not yet true.
        if (expiresAt !== null && expiresAt !== existing.expires_at) {
            await setEnrollmentDeadline({
                enrollmentId: existing.id as string,
                expiresAt,
                actorId: input.actorId,
            });
        }
        return { created: false, course, account, enrollmentId: existing.id as string, expiresAt };
    }

    const { data: inserted, error } = await db
        .from("lms_enrollments")
        .insert({
            course_id: course.id,
            auth_user_id: account.authUserId,
            source,
            status: "active",
            // Who handed this out. A purchase leaves `order_ref` to answer the
            // same question; a gift had nothing to answer it with until now.
            granted_by: input.actorId,
            ...(input.orderRef ? { order_ref: input.orderRef } : {}),
            // Day 1 starts now — same rule as `scripts/lms-grant.mjs`.
            started_at: new Date().toISOString(),
            expires_at: expiresAt,
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
            source,
            expires_at: expiresAt,
        },
    });

    return { created: true, course, account, enrollmentId: inserted.id as string, expiresAt };
}

/**
 * Moves, sets or clears one person's deadline on one course.
 *
 * Per enrollment rather than per course: the same course is sold with a year of
 * access to one cohort and a month to another, and support extends a single
 * person's date without touching anyone else's. `null` clears the deadline.
 *
 * Nothing is deleted — an expired enrollment keeps its progress, so extending
 * the date returns the learner exactly where they stopped.
 */
export async function setEnrollmentDeadline(input: {
    enrollmentId: string;
    expiresAt: string | null;
    actorId: string;
}) {
    const db = adminClient();

    const { data: enrollment, error: readError } = await db
        .from("lms_enrollments")
        .select("id, course_id, auth_user_id, expires_at")
        .eq("id", input.enrollmentId)
        .maybeSingle();
    if (readError) throw new AccessError(readError.message, 500);
    if (!enrollment) throw new AccessError("enrollment_not_found", 404);

    const { error } = await db
        .from("lms_enrollments")
        .update({ expires_at: input.expiresAt })
        .eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    const [{ data: course }, { data: account }] = await Promise.all([
        db.from("lms_courses").select("slug").eq("id", enrollment.course_id).maybeSingle(),
        db.from("platform_users").select("email").eq("auth_user_id", enrollment.auth_user_id).maybeSingle(),
    ]);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.deadline",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: course?.slug ?? null,
            grantee_email: account?.email ?? null,
            grantee_auth_user_id: enrollment.auth_user_id,
            // Both ends recorded: "who shortened this" is the question asked
            // afterwards, and the previous value is the only way to answer it.
            expires_at_before: (enrollment.expires_at as string | null) ?? null,
            expires_at_after: input.expiresAt,
        },
    });

    return {
        enrollmentId: enrollment.id as string,
        courseSlug: course?.slug ?? null,
        email: account?.email ?? null,
        expiresAt: input.expiresAt,
    };
}

/**
 * Creates a platform account for someone who has never signed in.
 *
 * Until now every grant needed the person to have logged in once, because
 * `platform_users` is written at sign-in. That is the wrong order for a sale
 * made by hand — the operator has the money and the email, and the buyer should
 * find the course waiting rather than be told to log in first and call back.
 *
 * The address is marked confirmed: it was verified out of band (a transfer, an
 * invoice, a message), and an unconfirmed address would silently refuse to
 * claim the very purchases this account is being made for — purchase linking
 * matches by email ONLY when the provider verified it.
 *
 * No password is set. The person signs in through the normal doors (OAuth, or a
 * magic link to this address), which is also why this is not a way to take over
 * an address that already has an account: an existing one is left untouched.
 */
export async function createAccount(input: { email: string; fullName?: string | null; actorId: string }) {
    const db = adminClient();
    const email = input.email.trim().toLowerCase();
    if (!email) throw new AccessError("email_required");

    const { data: existing } = await db
        .from("platform_users")
        .select("auth_user_id, email, full_name, avatar_url")
        .ilike("email", email)
        .maybeSingle();

    if (existing) {
        return {
            created: false,
            account: {
                authUserId: existing.auth_user_id as string,
                email: existing.email as string | null,
                fullName: existing.full_name as string | null,
                avatarUrl: existing.avatar_url as string | null,
            } satisfies AccessAccount,
        };
    }

    const fullName = input.fullName?.trim() || null;
    const created = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {},
    });

    if (created.error || !created.data?.user) {
        throw new AccessError(created.error?.message ?? "account_create_failed", 500);
    }

    const authUserId = created.data.user.id;

    const { error: profileError } = await db.from("platform_users").upsert(
        {
            auth_user_id: authUserId,
            email,
            full_name: fullName,
            provider: "manual",
        },
        { onConflict: "auth_user_id" }
    );
    if (profileError) throw new AccessError(profileError.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.account.create",
        entityType: "platform_user",
        entityId: authUserId,
        metadata: { email, full_name: fullName },
    });

    return {
        created: true,
        account: { authUserId, email, fullName, avatarUrl: null } satisfies AccessAccount,
    };
}

/**
 * Records money that arrived outside the payment provider.
 *
 * A bank transfer, cash, a partner's invoice — the sale is real, but WayForPay
 * never saw it, so no `orders` row exists and the buyer owns nothing: the LMS,
 * the profile and every revenue report read paid orders, not enrollments.
 * Writing the order is what makes a hand-made sale indistinguishable from an
 * automatic one everywhere downstream.
 *
 * The reference is prefixed `manual_` on purpose. It has to be obvious at a
 * glance — in a report, in the orders table, in the audit log — that a human
 * asserted this payment rather than a provider confirming it.
 */
export async function recordManualPayment(input: {
    email: string;
    productCode: string;
    amount: number;
    currency: PaymentCurrency;
    note?: string | null;
    actorId: string;
    /** Set when the buyer already has an account, so the purchase is theirs immediately. */
    authUserId?: string | null;
}) {
    const db = adminClient();
    const email = input.email.trim().toLowerCase();
    if (!email) throw new AccessError("email_required");

    const productCode = input.productCode.trim();
    if (!productCode) throw new AccessError("product_code_required");
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new AccessError("amount_invalid");

    const customerId = await resolveCustomerId(db, email, input.authUserId ?? null);

    const orderRef = manualOrderRef(productCode);
    const paidAt = new Date().toISOString();

    const { error } = await db.from("orders").insert({
        order_ref: orderRef,
        product_code: productCode,
        amount: input.amount,
        currency: input.currency,
        status: "paid",
        customer_id: customerId,
        created_at: paidAt,
    });
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "order.manual.record",
        entityType: "order",
        entityId: orderRef,
        metadata: {
            email,
            product_code: productCode,
            amount: input.amount,
            currency: input.currency,
            customer_id: customerId,
            note: input.note?.trim() || null,
        },
    });

    return { orderRef, customerId, amount: input.amount, currency: input.currency, productCode, paidAt };
}

/**
 * When a seat sold by hand should close, according to the offer.
 *
 * Anchored at the payment, exactly as `planAccess` anchors a checkout purchase,
 * so the same course sold at the till and sold in admin ends on the same day.
 * A course with no offer row, or one sold for good, has no end — the same
 * "unconfigured means perpetual" direction the door already takes.
 */
async function offerExpiryFor(db: Db, courseSlug: string, paidAt: string): Promise<string | null> {
    const { data: course } = await db.from("lms_courses").select("id").eq("slug", courseSlug).maybeSingle();
    if (!course?.id) return null;

    const { data: offer } = await db
        .from("lms_course_offers")
        .select("access_days, access_lifetime")
        .eq("course_id", course.id)
        .maybeSingle();
    if (!offer) return null;

    const rule = accessRuleOf({
        accessDays: (offer.access_days as number | null) ?? null,
        accessLifetime: (offer.access_lifetime as boolean | null) ?? null,
    });
    if (!rule || rule.lifetime) return null;

    const from = new Date(paidAt);
    if (!Number.isFinite(from.getTime())) return null;
    return accessWindowEnd(from, rule);
}

/**
 * The customer row a manual payment hangs on, created if this email has none.
 *
 * Linking `auth_user_id` here is what lets the LMS find the purchase: entitlement
 * looks up customers by account first and by verified email second, so an
 * unlinked row would leave the buyer staring at a locked course they paid for.
 */
async function resolveCustomerId(db: Db, email: string, authUserId: string | null): Promise<string> {
    const { data: existing, error: readError } = await db
        .from("customers")
        .select("id, auth_user_id")
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1);
    if (readError) throw new AccessError(readError.message, 500);

    const found = existing?.[0];
    if (found) {
        // Never re-point a row that already belongs to another account — that is
        // a support case, not an automatic merge (see `linkPurchasesToAccount`).
        if (authUserId && !found.auth_user_id) {
            await db.from("customers").update({ auth_user_id: authUserId }).eq("id", found.id).is("auth_user_id", null);
        }
        return found.id as string;
    }

    const { data: inserted, error } = await db
        .from("customers")
        .insert({ email, auth_user_id: authUserId })
        .select("id")
        .single();
    if (error) throw new AccessError(error.message, 500);

    return inserted.id as string;
}

function manualOrderRef(productCode: string): string {
    const token = productCode.replace(/[^a-z0-9-]+/gi, "-");
    const now = new Date();
    const stamp = [
        now.getUTCFullYear(),
        String(now.getUTCMonth() + 1).padStart(2, "0"),
        String(now.getUTCDate()).padStart(2, "0"),
    ].join("");
    const rand = Math.random().toString(16).slice(2, 10);
    return `manual_${token}_${stamp}_${rand}`;
}

export type ProvisionAccessInput = {
    email: string;
    fullName?: string | null;
    courseSlug: string;
    /** ISO instant or `null`; the route normalizes what the operator typed. */
    expiresAt?: string | null;
    /** Create the platform account when this email has never signed in. */
    createAccount?: boolean;
    /** Amount that arrived outside the provider. Omitted for a plain gift or a review grant. */
    payment?: { amount: number; currency: PaymentCurrency; note?: string | null } | null;
    /** Why this seat exists — `manual` unless the operator says bonus or promo. */
    source?: GrantSource;
    actorId: string;
};

/**
 * What would stop `grantCourse` from succeeding, checked BEFORE any money is
 * recorded.
 *
 * `provisionAccess` used to record the payment first and grant second, on the
 * theory that the enrollment should be backed by a real order rather than only
 * by an operator's word. That is still true, but it let a grant failure — the
 * course slug typo'd, the seat already banned — land AFTER the sale was
 * already written: the operator sees an error over a completed charge, and
 * pressing the button again records a second `orders` row for the same sale.
 * Checking the two conditions `grantCourse` would otherwise fail on, first and
 * without side effects, keeps the payment from being written for a grant that
 * cannot happen. `grantCourse` still re-checks both on its own — this does not
 * change what it validates, only when the operator finds out.
 */
async function assertGrantable(db: Db, courseSlug: string, authUserId: string): Promise<void> {
    const { data: course, error: courseError } = await db
        .from("lms_courses")
        .select("id, status")
        .eq("slug", courseSlug)
        .maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    // A manual sale sells the same product a buyer would get at checkout, and a
    // buyer can never reach an unpublished course — checkEntitlement only opens
    // published ones. Nothing enforced that here: an operator could seat a
    // learner on a draft, and the enrollment row would then be the only thing
    // blocking the author from ever deleting it (2026-08-28, novyi-kurs).
    if (course.status !== "published") throw new AccessError("course_not_published", 409);

    const { data: existing, error: enrollmentError } = await db
        .from("lms_enrollments")
        .select("blocked_at")
        .eq("course_id", course.id)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
    if (enrollmentError) throw new AccessError(enrollmentError.message, 500);
    if (existing?.blocked_at) throw new AccessError("enrollment_blocked", 409);
}

/**
 * The whole hand-made sale in one act: person, money, access, deadline.
 *
 * Composed here rather than in the route so the ORDER is stated once and holds:
 * the account must exist before the payment, so the customer row can be linked
 * to it; the grant is checked for the failures it can predict before the
 * payment is written, so a rejected grant never leaves a naked charge; the
 * payment must be written before the grant runs, so the enrollment is backed
 * by a real order rather than only by an operator's word.
 *
 * Each step is independently useful and independently audited — this only fixes
 * the sequence, it does not hide the steps.
 */
export async function provisionAccess(input: ProvisionAccessInput) {
    const db = adminClient();
    const account = input.createAccount
        ? await createAccount({ email: input.email, fullName: input.fullName, actorId: input.actorId })
        : { created: false, account: await resolveAccountByEmail(db, input.email) };

    await assertGrantable(db, input.courseSlug, account.account.authUserId);

    const payment = input.payment
        ? await recordManualPayment({
              email: input.email,
              productCode: courseOfferCode(input.courseSlug),
              amount: input.payment.amount,
              currency: input.payment.currency,
              note: input.payment.note,
              authUserId: account.account.authUserId,
              actorId: input.actorId,
          })
        : null;

    /* The term comes from the offer unless the operator overrode it.
       A hand-recorded sale used to ignore `access_days` entirely: selling a
       30-day course by hand granted it forever unless somebody remembered to
       type a date. The offer is where the term is agreed, so a sale made in
       admin is sold on the same terms as one made at the checkout. */
    const expiresAt =
        input.expiresAt !== undefined
            ? input.expiresAt
            : payment
              ? await offerExpiryFor(db, input.courseSlug, payment.paidAt)
              : null;

    const grant = await grantCourse({
        email: input.email,
        courseSlug: input.courseSlug,
        expiresAt,
        // A hand-recorded sale is a purchase in every way that matters, so it
        // is not filed as a gift: the money is real and the order exists.
        source: input.source ?? (payment ? "manual" : undefined),
        actorId: input.actorId,
        orderRef: payment?.orderRef ?? null,
    });

    return { accountCreated: account.created, account: grant.account, payment, grant };
}

/**
 * Revoke is a real reset: `lms_progress_events` cascades with the enrollment,
 * so the learner loses their history, not just the door. The UI says so.
 */
/**
 * Reads one enrollment with the context every access action needs to log.
 */
async function enrollmentContext(db: ReturnType<typeof adminClient>, enrollmentId: string) {
    const { data: enrollment, error } = await db
        .from("lms_enrollments")
        .select("id, course_id, auth_user_id, source, started_at, expires_at, status, blocked_at")
        .eq("id", enrollmentId)
        .maybeSingle();
    if (error) throw new AccessError(error.message, 500);
    if (!enrollment) throw new AccessError("enrollment_not_found", 404);

    const [{ data: course }, { data: account }] = await Promise.all([
        db.from("lms_courses").select("slug").eq("id", enrollment.course_id).maybeSingle(),
        db.from("platform_users").select("email").eq("auth_user_id", enrollment.auth_user_id).maybeSingle(),
    ]);

    return { enrollment, courseSlug: (course?.slug as string | null) ?? null, email: (account?.email as string | null) ?? null };
}

/**
 * Closes the seat WITHOUT destroying it.
 *
 * It used to delete the row, and that was wrong twice over. Entitlement is
 * derived from paid `orders`, which a delete leaves standing — so the learner's
 * next visit re-created the enrollment and the revoke quietly undid itself,
 * having thrown away every progress event on the way out. Now the row stays and
 * says `revoked`, which outranks the purchase that paid for it.
 *
 * A LATER purchase does re-open it (see `planAccess`): the revoke closed the
 * seat bought by the OLD payment, and refusing money already taken is not what
 * an operator meant by "забрати доступ". When the intent is that nothing should
 * re-open it, the action is `blockCourse`.
 */
export async function revokeCourse(input: { enrollmentId: string; actorId: string; reason?: string | null }) {
    const db = adminClient();
    const { enrollment, courseSlug, email } = await enrollmentContext(db, input.enrollmentId);

    const { error } = await db
        .from("lms_enrollments")
        .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.revoke",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: courseSlug,
            grantee_email: email,
            grantee_auth_user_id: enrollment.auth_user_id,
            source: enrollment.source,
            reason: input.reason ?? null,
        },
    });

    return { courseSlug, email, status: "revoked" as const };
}

/**
 * Re-opens a revoked seat, optionally on a new deadline.
 *
 * The progress is still there — that is the whole point of not deleting — so
 * the learner returns exactly where they stopped. A banned seat is NOT
 * reactivated here: lifting a ban is `unblockCourse`, a separate decision that
 * has to be taken deliberately.
 */
export async function reactivateCourse(input: {
    enrollmentId: string;
    actorId: string;
    expiresAt?: string | null;
}) {
    const db = adminClient();
    const { enrollment, courseSlug, email } = await enrollmentContext(db, input.enrollmentId);
    if (enrollment.blocked_at) throw new AccessError("enrollment_blocked", 409);

    const patch: Record<string, unknown> = {
        status: "active",
        revoked_at: null,
        updated_at: new Date().toISOString(),
    };
    // `undefined` leaves the deadline alone; `null` deliberately clears it.
    if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;

    const { error } = await db.from("lms_enrollments").update(patch).eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.reactivate",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: courseSlug,
            grantee_email: email,
            grantee_auth_user_id: enrollment.auth_user_id,
            expires_at_before: (enrollment.expires_at as string | null) ?? null,
            expires_at_after: input.expiresAt === undefined ? (enrollment.expires_at as string | null) ?? null : input.expiresAt,
        },
    });

    return { courseSlug, email, status: "active" as const };
}

/**
 * Bans this person from this course. No payment lifts it.
 *
 * Kept apart from the revoke because they answer to different things: a revoke
 * is commercial and a fresh purchase re-opens it, while a ban is about the
 * person and must not have a price. Folding them into one status would have
 * made "did they pay again?" the question that decides both.
 */
export async function blockCourse(input: { enrollmentId: string; actorId: string; reason?: string | null }) {
    const db = adminClient();
    const { enrollment, courseSlug, email } = await enrollmentContext(db, input.enrollmentId);

    const { error } = await db
        .from("lms_enrollments")
        .update({
            blocked_at: new Date().toISOString(),
            blocked_reason: input.reason ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.block",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: courseSlug,
            grantee_email: email,
            grantee_auth_user_id: enrollment.auth_user_id,
            reason: input.reason ?? null,
        },
    });

    return { courseSlug, email, status: "blocked" as const };
}

/** Lifts a ban. The seat returns to whatever its status and deadline already said. */
export async function unblockCourse(input: { enrollmentId: string; actorId: string }) {
    const db = adminClient();
    const { enrollment, courseSlug, email } = await enrollmentContext(db, input.enrollmentId);

    const { error } = await db
        .from("lms_enrollments")
        .update({ blocked_at: null, blocked_reason: null, updated_at: new Date().toISOString() })
        .eq("id", enrollment.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.course.unblock",
        entityType: "lms_enrollment",
        entityId: enrollment.id as string,
        metadata: {
            course_slug: courseSlug,
            grantee_email: email,
            grantee_auth_user_id: enrollment.auth_user_id,
        },
    });

    return { courseSlug, email };
}

async function customersByAccount(
    db: Db,
    accounts: Array<{ authUserId: string; email: string | null }>
): Promise<Map<string, string[]>> {
    const byAccount = new Map<string, string[]>();
    const seen = new Set<string>();

    const add = (authUserId: string, customerId: string) => {
        const key = `${authUserId}:${customerId}`;
        if (seen.has(key)) return;
        seen.add(key);
        byAccount.set(authUserId, [...(byAccount.get(authUserId) ?? []), customerId]);
    };

    const emailOwner = new Map<string, string>();
    for (const account of accounts) {
        const email = account.email?.trim().toLowerCase();
        // First account wins if the mirror somehow holds one address twice —
        // better than two accounts both claiming the same purchase.
        if (email && !emailOwner.has(email)) emailOwner.set(email, account.authUserId);
    }

    const ids = accounts.map((account) => account.authUserId);
    const emails = [...emailOwner.keys()];

    const [linked, byEmail] = await Promise.all([
        ids.length > 0
            ? db.from("customers").select("id, auth_user_id, email").in("auth_user_id", ids)
            : { data: [] },
        emails.length > 0 ? db.from("customers").select("id, auth_user_id, email").in("email", emails) : { data: [] },
    ]);

    for (const row of linked.data ?? []) add(row.auth_user_id as string, row.id as string);

    for (const row of byEmail.data ?? []) {
        const owner = emailOwner.get((row.email as string | null)?.trim().toLowerCase() ?? "");
        if (!owner) continue;
        // A row already claimed by another account is that account's purchase,
        // not this one's — a shared address is a support case, never a merge.
        const linkedTo = row.auth_user_id as string | null;
        if (linkedTo && linkedTo !== owner) continue;
        add(owner, row.id as string);
    }

    return byAccount;
}

async function paidOrderCounts(db: Db, customerIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (customerIds.length === 0) return counts;

    const { data } = await db.from("orders").select("customer_id, status").in("customer_id", customerIds);
    for (const row of data ?? []) {
        if (String(row.status ?? "").toLowerCase() !== "paid") continue;
        const key = row.customer_id as string;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
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
            authorProfileId: (row.author_profile_id as string | null) ?? null,
            learners: learners.get(row.id as string) ?? 0,
            updatedAt: row.updated_at as string,
        } satisfies CourseRow;
    });
}

export async function listAuthorProfiles(): Promise<AuthorProfileRow[]> {
    const db = adminClient();
    const { data, error } = await db.from("lms_authors").select("id, slug, name").order("name", { ascending: true });
    if (error) throw new AccessError(error.message, 500);
    return (data ?? []).map((row) => ({
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
    }));
}

/** Admin route only. The single DELETE cascades atomically in Postgres;
 * accounts, orders and audit_log do not belong to that cascade. */
export async function deleteAdminCourse(input: { courseId: string; confirmSlug: string; actorId: string }) {
    const db = adminClient();
    const { data: course, error: readError } = await db.from("lms_courses")
        .select("id, slug, title").eq("id", input.courseId).maybeSingle();
    if (readError) throw new AccessError(readError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);
    if (input.confirmSlug !== course.slug) throw new AccessError("course_delete_confirmation_required", 400);

    const { count, error: countError } = await db.from("lms_enrollments")
        .select("id", { count: "exact", head: true }).eq("course_id", course.id);
    if (countError) throw new AccessError(countError.message, 500);
    // Fail closed if the destructive request cannot be recorded. This entry
    // describes intent, so a database rejection cannot masquerade as success.
    const { error: auditError } = await db.from("audit_log").insert({
        actor_id: input.actorId, action: "course.delete_requested",
        entity_type: "lms_course", entity_id: input.courseId,
        metadata: { slug: course.slug, title: course.title, learners: count ?? 0 },
    });
    if (auditError) throw new AccessError("course_delete_audit_failed", 500);
    const { data: deleted, error } = await db.from("lms_courses").delete()
        .eq("id", input.courseId).eq("slug", input.confirmSlug).select("id");
    if (error) throw new AccessError(error.message, 500);
    if (!deleted?.length) throw new AccessError("course_not_found", 404);
    await writeAudit(db, { actorId: input.actorId, action: "course.deleted", entityType: "lms_course",
        entityId: input.courseId, metadata: { slug: course.slug, learners: count ?? 0 } });
    return { id: input.courseId, slug: course.slug as string };
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
        /* WHAT THIS RELAXATION FIXES. A course PUBLISHED IN THE BUILDER that
           never passed through review sits at `review_status = 'draft'`. The
           old rule refused to approve anything but `in_review`, while the
           storefront refused any visibility but `hidden` unless it was
           approved — so such a course could never be listed by anyone, and
           `ideal-body` had been stuck in exactly that corner. An admin
           approving already-published material is a legitimate act; it is
           audited like every other.

           A PENDING REVISION still requires the queue: that is unpublished
           material waiting on a decision, and waving it through unreviewed is
           the thing review exists to prevent. */
        const approvable =
            reviewStatus === "in_review" || (!hasPendingRevision && course.status === "published");
        if (!approvable) throw new AccessError("course_not_in_review", 409);
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
            }, {
                // `pending_content` is the author's own saved payload, reviewed as
                // it stands — so it speaks for the storefront columns exactly as the
                // builder's save does. Approving must publish what was reviewed,
                // including a field the author deliberately emptied.
                optionalColumns: "authoritative",
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
        // Hiding is always allowed: taking something OFF the storefront must
        // never be gated on the state that put it there.
        // Visibility belongs to the live version. A separate draft may still
        // await review without withdrawing the already approved publication.
        const liveReviewStatus = course.review_status ?? (course.status === "published" ? "approved" : "draft");
        if (input.visibility !== "hidden" && (course.status !== "published" || liveReviewStatus !== "approved")) {
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

/** Select the public byline without editing the selected person's profile. */
export async function setCourseAuthorProfile(input: { courseId: string; authorProfileId: string | null; actorId: string }) {
    const db = adminClient();
    const { data: course, error: courseError } = await db.from("lms_courses")
        .select("id, slug, author_profile_id").eq("id", input.courseId).maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    if (input.authorProfileId) {
        const { data: profile, error: profileError } = await db.from("lms_authors")
            .select("id").eq("id", input.authorProfileId).maybeSingle();
        if (profileError) throw new AccessError(profileError.message, 500);
        if (!profile) throw new AccessError("author_profile_not_found", 404);
    }

    const before = (course.author_profile_id as string | null) ?? null;
    const { error } = await db.from("lms_courses").update({ author_profile_id: input.authorProfileId }).eq("id", input.courseId);
    if (error) throw new AccessError(error.message, 500);
    await writeAudit(db, {
        actorId: input.actorId,
        action: input.authorProfileId ? "course.author_profile_set" : "course.author_profile_cleared",
        entityType: "lms_course",
        entityId: input.courseId,
        metadata: { course_slug: course.slug, author_profile_before: before, author_profile_after: input.authorProfileId },
    });
    return { id: input.courseId, slug: course.slug as string, authorProfileId: input.authorProfileId };
}
