/**
 * Courses as the admin sees them: listing, moderation, deletion, authorship.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import type { TablesUpdate } from "@/lib/db/database.types";
import { writeCourseStructure } from "@/lib/lms/authoring";
import { JOURNAL_MIGRATION_REQUIRED, writeCourseRelease } from "@/lib/lms/release";
import { validateCourse, type Course } from "@/lms-core";
import type { AuthorProfileRow, CourseRow } from "@/lib/admin/accessTypes";
import { resolveAccountByEmail } from "./accounts";
import { AccessError, accountsByIds, writeAudit } from "./shared";

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

    let values: TablesUpdate<"lms_courses">;
    // Set when the approval below already wrote `values` inside the release
    // transaction, so the trailing UPDATE does not repeat them.
    let releaseApplied = false;
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
            const released: Course = {
                ...revision,
                id: course.id as string,
                slug: course.slug as string,
                status: "published",
                visibility: (course.visibility ?? "hidden") as Course["visibility"],
                version: Number(course.version ?? revision.version) + 1,
            };
            /* APPROVAL IS THE ONE MOMENT WORTH PROVING, and until now it was the
               one moment that erased its own evidence: the reviewed document
               lives in `pending_content`, and the line below nulls it. What
               survived was `audit_log` saying an approval happened, with no way
               to answer what was approved — so "the author rewrote the material
               after passing review" could be neither shown nor ruled out.

               `writeCourseRelease` projects the document onto the learner rows
               and appends the immutable `published` revision in ONE transaction,
               which also closes the older gap this path carried: a module or
               lesson upsert failing partway used to leave the course half
               written with the approval already recorded. */
            const approvalValues: Record<string, unknown> = {
                review_status: "approved", review_note: null, approved_at: new Date().toISOString(), approved_by: input.actorId,
                pending_content: null, pending_review_status: null, pending_review_note: null, pending_submitted_at: null, pending_updated_at: null,
            };
            try {
                await writeCourseRelease({
                    courseId: course.id as string,
                    course: released,
                    finalValues: approvalValues,
                    // `pending_content` is the author's own saved payload, reviewed as
                    // it stands — so it speaks for the storefront columns exactly as the
                    // builder's save does. Approving must publish what was reviewed,
                    // including a field the author deliberately emptied.
                    optionalColumns: "authoritative",
                    journal: { kind: "published", actorId: input.actorId, label: "Затверджено рецензентом" },
                });
                releaseApplied = true;
            } catch (error) {
                /* The journal migration is hand-applied, so an unmigrated
                   database must still be able to approve — it simply approves
                   the way it did yesterday, without the artifact. Any other
                   failure is a real one and must not be swallowed into a
                   partially applied release. */
                if (!(error instanceof Error) || error.message !== JOURNAL_MIGRATION_REQUIRED) throw error;
                console.warn(`access: approval of ${course.slug} not journaled — ${JOURNAL_MIGRATION_REQUIRED}`);
                const writer = db as unknown as Parameters<typeof writeCourseStructure>[0];
                await writeCourseStructure(writer, released, { optionalColumns: "authoritative" });
            }
            values = approvalValues;
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
    if (!releaseApplied) {
        const { error } = await db.from("lms_courses").update(values).eq("id", input.courseId);
        if (error) throw new AccessError(error.message, 500);
    }
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
