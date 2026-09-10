/**
 * People: resolving an account, searching and listing them, creating one.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { accessStateOf, daysRemaining } from "@/lms-core";
import { foldProgress, type ProgressEvent, type ProgressEventType } from "@/lms-core/progress";
import { ELEVATED_ROLES, groupLearnersByAccount, learnerStatusOf, type AccessFacet, type PersonRow } from "@/lib/admin/accessTypes";
import type { LearnerAccountRow, LearnerRow, LearnerStatus } from "@/lib/admin/accessTypes";
import { AccessError, FOLD_CEILING, accountsByIds, type AccessAccount, type Db, writeAudit } from "./shared";

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

    const paidByCustomer = await paidOrdersByCustomer(db, [...new Set([...customerIdByAccount.values()].flat())]);

    /* THE TITLES FOR COURSES THAT WERE PAID FOR AND NEVER OPENED.
       One query for the whole page rather than one per person: the slugs come
       out of the orders above, and there are at most a handful of distinct ones
       on a page of accounts. */
    const paidCourseSlugs = new Set<string>();
    for (const orders of paidByCustomer.values()) {
        for (const order of orders) {
            const slug = courseSlugFromProductCode(order.productCode);
            if (slug) paidCourseSlugs.add(slug);
        }
    }
    const courseTitleBySlug = new Map<string, string>();
    if (paidCourseSlugs.size > 0) {
        const { data: paidCourses } = await db
            .from("lms_courses")
            .select("slug, title")
            .in("slug", [...paidCourseSlugs]);
        for (const row of paidCourses ?? []) {
            courseTitleBySlug.set(row.slug as string, (row.title as string | null) ?? (row.slug as string));
        }
    }

    /* What they paid for, minus what they have actually opened.
       A course they are already enrolled in is NOT reported here — the
       enrollment row is the answer then, and saying it twice would read as two
       courses. A product that is not a course (`consult`, a physical item) has
       no enrollment to be missing and is skipped by `courseSlugFromProductCode`.
       A `course:` code with no matching row in `lms_courses` is skipped too:
       that is a stale product code, and inventing a title for it would put a
       course in the panel that does not exist. */
    const entitledNotEnrolledFor = (
        customerIds: string[],
        enrolled: readonly { courseSlug: string }[]
    ): PersonRow["entitledNotEnrolled"] => {
        const enrolledSlugs = new Set(enrolled.map((course) => course.courseSlug));
        const seen = new Set<string>();
        const out: PersonRow["entitledNotEnrolled"] = [];

        for (const customerId of customerIds) {
            for (const order of paidByCustomer.get(customerId) ?? []) {
                const slug = courseSlugFromProductCode(order.productCode);
                if (!slug || enrolledSlugs.has(slug) || seen.has(slug)) continue;
                const title = courseTitleBySlug.get(slug);
                if (!title) continue;
                seen.add(slug);
                out.push({ slug, title, orderRef: order.orderRef, paidAt: order.paidAt });
            }
        }
        return out;
    };

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
            purchases: customers.reduce((sum, id) => sum + (paidByCustomer.get(id)?.length ?? 0), 0),
            ownedCourses: ownedByAuthor.get(authUserId) ?? 0,
            entitledNotEnrolled: entitledNotEnrolledFor(customers, held?.courses ?? []),
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

type PaidOrder = { productCode: string | null; orderRef: string; paidAt: string | null };

/**
 * The paid orders behind each customer — how many, and what they bought.
 *
 * It used to select only `status` and return a count, which is why the panel
 * could say «Покупок: 1» and nothing about which course that was. The product
 * code was one column away the whole time.
 */
async function paidOrdersByCustomer(db: Db, customerIds: string[]): Promise<Map<string, PaidOrder[]>> {
    const byCustomer = new Map<string, PaidOrder[]>();
    if (customerIds.length === 0) return byCustomer;

    const { data } = await db
        .from("orders")
        .select("customer_id, status, product_code, order_ref, created_at")
        .in("customer_id", customerIds);

    for (const row of data ?? []) {
        if (String(row.status ?? "").toLowerCase() !== "paid") continue;
        const key = row.customer_id as string;
        const list = byCustomer.get(key) ?? [];
        list.push({
            productCode: (row.product_code as string | null) ?? null,
            orderRef: (row.order_ref as string | null) ?? "",
            paidAt: (row.created_at as string | null) ?? null,
        });
        byCustomer.set(key, list);
    }
    return byCustomer;
}

/**
 * `course:natural-body` -> `natural-body`. Anything that is not a course sale
 * — a consult, a product — has no course to be enrolled in and is skipped.
 */
function courseSlugFromProductCode(productCode: string | null): string | null {
    if (!productCode) return null;
    const match = /^course:(.+)$/.exec(productCode.trim());
    return match ? match[1] : null;
}
