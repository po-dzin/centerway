/**
 * A learner's seat on a course: granting, deadlines, revoking, blocking.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import type { TablesUpdate } from "@/lib/db/database.types";
import type { GrantSource } from "@/lib/admin/accessTypes";
import { resolveAccountByEmail } from "./accounts";
import { AccessError, type Db, writeAudit } from "./shared";

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
export async function assertGrantable(db: Db, courseSlug: string, authUserId: string): Promise<void> {
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

    const patch: TablesUpdate<"lms_enrollments"> = {
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
