import type { AccessState } from "@/lms-core";

/**
 * Shapes shared by the access API and the admin page.
 *
 * Kept apart from `access.ts` on purpose: that module imports `adminClient`,
 * which reads the service-role key. The panel is a client component, so it must
 * be able to name these types without pulling the server module into the
 * browser bundle.
 */

export type LearnerStatus = "not_started" | "in_progress" | "stalled" | "completed";

/**
 * Sources a hand-made grant may declare.
 *
 * `manual` is the plain admin grant and stays the default; `bonus` and
 * `promotion` exist so that "why does this person have this?" is answerable
 * from the row a year later, without a note in a Telegram thread. `order` and
 * `token` are never chosen here — a purchase writes those itself.
 */
export const GRANT_SOURCES = ["manual", "bonus", "promotion"] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];

export function isGrantSource(value: unknown): value is GrantSource {
    return typeof value === "string" && (GRANT_SOURCES as readonly string[]).includes(value);
}

export type LearnerRow = {
    enrollmentId: string;
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    courseStatus: string;
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    source: string;
    orderRef: string | null;
    startedAt: string;
    expiresAt: string | null;
    /** Whether the door is open right now, and if not, why. Derived, never stored. */
    access: AccessState;
    /** Whole days left on the window; `null` when it has no end. */
    daysLeft: number | null;
    blockedReason: string | null;
    lessonsTotal: number;
    lessonsCompleted: number;
    lastActivityAt: string | null;
    status: LearnerStatus;
};

export type CourseRow = {
    id: string;
    slug: string;
    title: string;
    status: string;
    reviewStatus: "draft" | "in_review" | "changes_requested" | "approved";
    reviewNote: string | null;
    reviewEnabled: boolean;
    /** A published release exists, while the displayed review state belongs to its next version. */
    hasPendingRevision: boolean;
    visibility: "hidden" | "unlisted" | "listed";
    locale: string;
    brand: string;
    authorId: string | null;
    authorEmail: string | null;
    authorName: string | null;
    learners: number;
    updatedAt: string;
};


export type RoleRow = {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    role: string;
    lastSignInAt: string | null;
    updatedAt: string | null;
    ownedCourses: number;
    enrollments: number;
};

/** Roles `user_roles` accepts — mirrors its CHECK, widened by the 2026-08-21 merge. */
export const GRANTABLE_ROLES = ["user", "coach", "support", "admin"] as const;

/**
 * The roles that mean "this person can do something an ordinary account cannot".
 *
 * `user` is not one of them: it is what everybody is, and what "remove the role"
 * writes back. Kept beside GRANTABLE_ROLES so the two cannot drift — adding a
 * role to that list and forgetting this one would quietly hide its holders from
 * the "staff" filter.
 */
export const ELEVATED_ROLES = GRANTABLE_ROLES.filter((role) => role !== "user");
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

/** Payment currencies the panel offers for a hand-recorded sale. UAH first — the merchant settles in it. */
export const PAYMENT_CURRENCIES = ["UAH", "USD", "EUR"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export function isPaymentCurrency(value: unknown): value is PaymentCurrency {
    return typeof value === "string" && (PAYMENT_CURRENCIES as readonly string[]).includes(value);
}

/** How stale an in-progress learner must be before the panel calls them stalled. */
export const STALLED_AFTER_DAYS = 7;

/**
 * The one definition of a learner's state.
 *
 * `not_started` is "no progress event at all", not "no completed lesson" — a
 * learner who opened day 1 this morning is working, not idle. `completed`
 * needs a known lesson count, so a course with no lessons yet can never look
 * finished.
 */
export function learnerStatusOf(
    lessonsTotal: number,
    lessonsCompleted: number,
    lastActivityAt: string | null,
    now: number = Date.now()
): LearnerStatus {
    if (lastActivityAt === null) return "not_started";
    if (lessonsTotal > 0 && lessonsCompleted >= lessonsTotal) return "completed";

    const staleAfter = now - STALLED_AFTER_DAYS * 24 * 60 * 60 * 1000;
    return new Date(lastActivityAt).getTime() < staleAfter ? "stalled" : "in_progress";
}

export function isGrantableRole(value: unknown): value is GrantableRole {
    return typeof value === "string" && (GRANTABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Turns what an operator typed into a deadline the database can hold.
 *
 * The panel uses `<input type="date">`, so the common value is a bare
 * `YYYY-MM-DD`. A bare date means "through the end of that day", not "at
 * midnight, when the day begins" — an operator who types today's date is giving
 * access for today, not taking it away retroactively. The end of day is fixed in
 * UTC rather than in the learner's timezone: it is a couple of hours generous
 * for Kyiv, and being generous is the right way to be wrong about a deadline.
 *
 * An empty string is a deliberate `null` — that is how the UI clears a deadline.
 */
export function normalizeDeadline(raw: unknown): { ok: true; value: string | null } | { ok: false } {
    if (raw === null || raw === undefined) return { ok: true, value: null };
    if (typeof raw !== "string") return { ok: false };

    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, value: null };

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const endOfDay = new Date(`${trimmed}T23:59:59.999Z`);
        return Number.isNaN(endOfDay.getTime()) ? { ok: false } : { ok: true, value: endOfDay.toISOString() };
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? { ok: false } : { ok: true, value: parsed.toISOString() };
}

/**
 * What the grant form sends for a deadline, given its two controls.
 *
 * THREE ANSWERS, NOT TWO. Ticked ("Безстроково") is the operator stating
 * perpetual access explicitly — sent as `null`, which overrides whatever term
 * the course is normally sold with. A typed date, once unticked, is the other
 * explicit override. Unticked with nothing typed is neither: it is the
 * operator not having said anything about the term, so nothing is sent
 * (`undefined`, dropped by JSON.stringify) and `provisionAccess` fills it in
 * from the course's own offer.
 *
 * That last answer changed shape on 2026-08-28. An empty date used to mean
 * `null` unconditionally — the checkbox above only gave that existing meaning
 * a name. It could not stay that once a hand-recorded sale started reading the
 * offer's own term: selling a 30-day course by hand was granting it forever
 * whenever nobody typed a date, which was every sale before the term became
 * something the checkout itself would have applied. The checkbox still means
 * exactly what its label says — the silent default underneath it moved instead,
 * from "forever" to "whatever this course is normally sold with".
 */
export function grantDeadlineValue(forever: boolean, dateInput: string): string | null | undefined {
    if (forever) return null;
    return dateInput || undefined;
}

/** The `<input type="date">` value for a stored deadline, in UTC to match how it was written. */
export function deadlineInputValue(expiresAt: string | null): string {
    if (!expiresAt) return "";
    const parsed = new Date(expiresAt);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export type LearnerAccountRow = {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    /** Every enrollment this person holds, newest first. Empty for an account with none. */
    courses: LearnerRow[];
    lessonsTotal: number;
    lessonsCompleted: number;
    lastActivityAt: string | null;
    status: LearnerStatus;
};

/**
 * One person, with everything the panel knows about them.
 *
 * THE TWO LISTS WERE THE SAME LIST. `LearnerAccountRow` was accounts that hold
 * a course; the account row was accounts, full stop. Merging them is step 2 of
 * docs/admin-access-shape-2026-08-28.md — "holds a course" is an attribute of a
 * person, so it belongs on a facet rather than on a tab of its own.
 *
 * `courses` is empty rather than absent for somebody who holds none. That is
 * the whole point of the merge: an account that has never enrolled is a row
 * here, not a gap.
 */
export type PersonRow = LearnerAccountRow & {
    /** Sign-in provider as recorded at sync; `manual` for an account the panel made. */
    provider: string | null;
    lastSignInAt: string | null;
    /** `null` when there is no `user_roles` row at all, which is most people. */
    role: string | null;
    /** When that role was last written. */
    roleUpdatedAt: string | null;
    /** Paid orders reachable from this account, by link or by matching email. */
    purchases: number;
    /** Courses this person authors (`lms_courses.author_id`). */
    ownedCourses: number;
};

/** Which people a listing wants: everybody, only those holding a course, or only those with none. */
export type AccessFacet = "" | "enrolled" | "none";

/**
 * How one person's several courses collapse into one headline status.
 *
 * Ordered by "who needs a look first", not by progress: a stalled course is the
 * reason to open the row, and a finished one is the reason not to. So a learner
 * who finished Reset Day but went quiet on Way21 reads as stalled, which is the
 * true thing about them.
 */
export const ACCOUNT_STATUS_PRECEDENCE: readonly LearnerStatus[] = [
    "stalled",
    "in_progress",
    "not_started",
    "completed",
] as const;

/**
 * Fold enrollment rows into one row per account.
 *
 * Input order is preserved (the query sorts by start date, newest first), so
 * the page keeps a stable order without a second sort, and each person's
 * courses stay in that same order inside their row.
 */
export function groupLearnersByAccount(rows: LearnerRow[]): LearnerAccountRow[] {
    const byAccount = new Map<string, LearnerAccountRow>();

    for (const row of rows) {
        const existing = byAccount.get(row.authUserId);
        if (existing) {
            existing.courses.push(row);
            continue;
        }
        byAccount.set(row.authUserId, {
            authUserId: row.authUserId,
            email: row.email,
            fullName: row.fullName,
            avatarUrl: row.avatarUrl,
            courses: [row],
            lessonsTotal: 0,
            lessonsCompleted: 0,
            lastActivityAt: null,
            status: "not_started",
        });
    }

    return [...byAccount.values()].map((account) => {
        let lessonsTotal = 0;
        let lessonsCompleted = 0;
        let lastActivityAt: string | null = null;
        const present = new Set<LearnerStatus>();

        for (const course of account.courses) {
            lessonsTotal += course.lessonsTotal;
            lessonsCompleted += course.lessonsCompleted;
            present.add(course.status);
            if (course.lastActivityAt && (!lastActivityAt || course.lastActivityAt > lastActivityAt)) {
                lastActivityAt = course.lastActivityAt;
            }
        }

        return {
            ...account,
            lessonsTotal,
            lessonsCompleted,
            lastActivityAt,
            status: ACCOUNT_STATUS_PRECEDENCE.find((status) => present.has(status)) ?? "not_started",
        };
    });
}
