/**
 * Shapes shared by the access API and the admin page.
 *
 * Kept apart from `access.ts` on purpose: that module imports `adminClient`,
 * which reads the service-role key. The panel is a client component, so it must
 * be able to name these types without pulling the server module into the
 * browser bundle.
 */

export type LearnerStatus = "not_started" | "in_progress" | "stalled" | "completed";

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
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

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

export type LearnerAccountRow = {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    /** Every enrollment this person holds, newest first. */
    courses: LearnerRow[];
    lessonsTotal: number;
    lessonsCompleted: number;
    lastActivityAt: string | null;
    status: LearnerStatus;
};

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
