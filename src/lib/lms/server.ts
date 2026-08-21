/**
 * Server-side LMS operations: entitlement → enrollment → progress.
 *
 * This module is the ONLY place that talks to the database for learning data.
 * All decisions (who may open what, when a lesson unlocks, what counts as done)
 * are delegated to `src/lms-core`, which stays platform-free so a native app or
 * a Mini App can reuse the same rules over HTTP.
 *
 * Server-only: imports the service-role client. Never import from a client component.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { isStaffRole } from "@/lib/platform/adminRole";
import {
  DEFAULT_TIMEZONE,
  foldProgress,
  resolveCurrentLesson,
  resolveEntitlement,
  resolveTimeZone,
  summarizeStanding,
  type Course,
  type CourseProgress,
  type CourseStandingSummary,
  type ProgressEvent,
  type ProgressEventType,
} from "@/lms-core";
import { linkPurchasesToAccount } from "@/lib/platform/linkPurchases";
import { getCourse, listCourses } from "./catalog";

/**
 * Staff may open draft courses; buyers may not.
 *
 * Reads `user_roles`, like every other authorisation in this codebase. It used
 * to read `platform_users.role` — the other, unsynchronised store — which made
 * this the single place where "who is staff" could answer differently from
 * "who is admin". Nothing kept the two columns in step, so an account elevated
 * in one was silently ordinary in the other, in whichever direction.
 *
 * Switching it changed access for nobody: at the time of the change the two
 * stores agreed for every account that held any elevated role. That is what
 * made it safe to do rather than something to schedule.
 */
export async function isStaff(authUserId: string): Promise<boolean> {
  const db = adminClient();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle();

  return isStaffRole(data?.role);
}

/**
 * Whether this account holds a hand-issued grant for the course.
 * Used to let reviewers open a draft without granting them admin rights.
 */
async function hasManualGrant(authUserId: string, courseId: string): Promise<boolean> {
  const db = adminClient();
  const { data } = await db
    .from("lms_enrollments")
    .select("source")
    .eq("auth_user_id", authUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  return data?.source === "manual";
}

export type LearnerIdentity = {
  authUserId: string;
  email: string | null;
  /**
   * Whether the identity provider verified this email.
   *
   * Load-bearing for access: purchases are matched by email as a fallback, so an
   * unverified address would let anyone claim someone else's paid course simply
   * by signing up with their address.
   */
  emailVerified: boolean;
};

export type EnrollmentRecord = {
  id: string;
  courseId: string;
  startedAt: Date;
  source: "order" | "token" | "manual";
  orderRef: string | null;
};

export type LearnerSettings = {
  timeZone: string;
};

/** Reads the learner's timezone; falls back to Kyiv when unset or invalid. */
export async function getLearnerSettings(authUserId: string): Promise<LearnerSettings> {
  const db = adminClient();
  const { data } = await db
    .from("platform_users")
    .select("timezone")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return { timeZone: resolveTimeZone(data?.timezone ?? DEFAULT_TIMEZONE) };
}

async function findCustomerIds(identity: LearnerIdentity): Promise<string[]> {
  const db = adminClient();
  const ids = new Set<string>();

  const byAuth = await db.from("customers").select("id").eq("auth_user_id", identity.authUserId);
  for (const row of byAuth.data ?? []) ids.add(row.id);

  // Purchases made before the account existed carry no auth_user_id, so they are
  // matched by email — but ONLY when the provider verified that email, otherwise
  // claiming a stranger's courses would be as easy as typing their address.
  if (identity.email && identity.emailVerified) {
    const byEmail = await db.from("customers").select("id").ilike("email", identity.email.trim().toLowerCase());
    for (const row of byEmail.data ?? []) ids.add(row.id);
  }

  return [...ids];
}

/**
 * Does this learner own this course?
 *
 * Entitlement is derived from paid orders and their access tokens, never from a
 * specific payment provider — adding Stripe or a merchant-of-record later means
 * new order rows, not new logic here.
 *
 * Staff bypass entitlement outright — they may open a published course without
 * ever having paid for it, the same way they already open a draft. Checked here
 * rather than per-caller so the shelf, auto-enrollment and manual review all
 * agree without a `lms:grant` row per course per admin.
 */
export async function checkEntitlement(
  identity: LearnerIdentity,
  course: Course,
  now = new Date()
): Promise<ReturnType<typeof resolveEntitlement>> {
  if (await isStaff(identity.authUserId)) {
    return { entitled: true, source: "manual", grantedAt: now.toISOString(), orderRef: null };
  }

  const db = adminClient();
  const customerIds = await findCustomerIds(identity);

  if (customerIds.length === 0) {
    return { entitled: false, reason: "no_paid_order" };
  }

  const ordersResult = await db
    .from("orders")
    .select("order_ref, product_code, status, created_at")
    .in("customer_id", customerIds);

  const orders = (ordersResult.data ?? []).map((order) => ({
    orderRef: order.order_ref,
    productCode: order.product_code ?? "",
    status: order.status ?? "",
    createdAt: order.created_at ?? new Date(0).toISOString(),
  }));

  const orderRefs = orders.map((order) => order.orderRef).filter(Boolean);
  const tokensResult =
    orderRefs.length > 0
      ? await db.from("access_tokens").select("order_ref, used, expires_at").in("order_ref", orderRefs)
      : { data: [] };

  const tokens = (tokensResult.data ?? []).map((token) => ({
    orderRef: token.order_ref,
    used: Boolean(token.used),
    expiresAt: token.expires_at ?? null,
  }));

  return resolveEntitlement({
    courseProductCodes: course.entitlementProductCodes,
    courseSlug: course.slug,
    orders,
    tokens,
    now,
  });
}

/**
 * Returns the learner's enrollment, creating it on first entitled visit.
 *
 * Auto-provisioning is what replaces "after payment — a Telegram button": the
 * purchase alone is enough to start the course on the platform.
 */
export async function ensureEnrollment(
  identity: LearnerIdentity,
  course: Course,
  now = new Date()
): Promise<{ enrollment: EnrollmentRecord } | { enrollment: null; reason: "not_entitled" | "expired" }> {
  const db = adminClient();

  const existing = await db
    .from("lms_enrollments")
    .select("id, course_id, started_at, source, order_ref")
    .eq("course_id", course.id)
    .eq("auth_user_id", identity.authUserId)
    .maybeSingle();

  if (existing.data) {
    return {
      enrollment: {
        id: existing.data.id,
        courseId: existing.data.course_id,
        startedAt: new Date(existing.data.started_at),
        source: existing.data.source,
        orderRef: existing.data.order_ref,
      },
    };
  }

  const entitlement = await checkEntitlement(identity, course, now);
  if (!entitlement.entitled) {
    return { enrollment: null, reason: entitlement.reason === "expired" ? "expired" : "not_entitled" };
  }

  // Day 1 is the day the learner FIRST OPENS the course, not the day they paid
  // (decision 2026-08-15). Buying on Friday and starting on Sunday must not burn
  // two days of a three-day protocol — the clock belongs to the learner, not to
  // the invoice. `entitlement.grantedAt` stays available for reporting.
  const startedAt = now;

  const inserted = await db
    .from("lms_enrollments")
    .insert({
      course_id: course.id,
      auth_user_id: identity.authUserId,
      source: entitlement.source,
      order_ref: entitlement.orderRef,
      started_at: startedAt.toISOString(),
    })
    .select("id, course_id, started_at, source, order_ref")
    .single();

  if (inserted.error || !inserted.data) {
    // A concurrent request may have won the unique (course_id, auth_user_id).
    const retry = await db
      .from("lms_enrollments")
      .select("id, course_id, started_at, source, order_ref")
      .eq("course_id", course.id)
      .eq("auth_user_id", identity.authUserId)
      .maybeSingle();

    if (!retry.data) {
      throw new Error(`lms_enrollment_insert_failed:${inserted.error?.message ?? "unknown"}`);
    }

    return {
      enrollment: {
        id: retry.data.id,
        courseId: retry.data.course_id,
        startedAt: new Date(retry.data.started_at),
        source: retry.data.source,
        orderRef: retry.data.order_ref,
      },
    };
  }

  return {
    enrollment: {
      id: inserted.data.id,
      courseId: inserted.data.course_id,
      startedAt: new Date(inserted.data.started_at),
      source: inserted.data.source,
      orderRef: inserted.data.order_ref,
    },
  };
}

/** Reads the raw event log and folds it into current progress. */
export async function loadProgress(enrollmentId: string): Promise<CourseProgress> {
  const db = adminClient();
  const { data, error } = await db
    .from("lms_progress_events")
    .select("client_id, type, lesson_id, payload, occurred_at")
    .eq("enrollment_id", enrollmentId)
    .order("occurred_at", { ascending: true });

  if (error) throw new Error(`lms_progress_read_failed:${error.message}`);

  const events: ProgressEvent[] = (data ?? []).map((row) => ({
    clientId: row.client_id,
    type: row.type as ProgressEventType,
    lessonId: row.lesson_id,
    occurredAt: row.occurred_at,
    payload: (row.payload ?? {}) as ProgressEvent["payload"],
  }));

  return foldProgress(events);
}

export type RecordEventInput = {
  enrollmentId: string;
  lessonId: string;
  type: ProgressEventType;
  clientId: string;
  occurredAt?: string;
  payload?: ProgressEvent["payload"];
};

/**
 * Appends one progress event.
 *
 * Idempotent by (enrollment_id, client_id): a retried request — or a batch
 * flushed twice by a future offline client — is a no-op rather than a duplicate.
 */
export async function recordProgressEvent(input: RecordEventInput): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("lms_progress_events").insert({
    enrollment_id: input.enrollmentId,
    lesson_id: input.lessonId,
    type: input.type,
    client_id: input.clientId,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload ?? {},
  });

  // 23505 = unique_violation — the event is already recorded, which is success.
  if (error && error.code !== "23505") {
    throw new Error(`lms_progress_write_failed:${error.message}`);
  }
}

export type LearnerShelfEntry = {
  course: Course;
  /** `enrolled` — already started; `available` — paid but never opened; `locked` — not owned. */
  access: "enrolled" | "available" | "locked";
  lockReason: "not_entitled" | "expired" | null;
  startedAt: string | null;
  standing: CourseStandingSummary | null;
  currentLessonSlug: string | null;
  currentLessonTitle: string | null;
};

/**
 * Every course this account can see, for the cabinet shelf.
 *
 * Deliberately READ-ONLY: unlike `loadLearnerCourse`, it never creates an
 * enrollment. Day 1 starts when the learner opens the course, so merely landing
 * on the cabinet must not start the clock (decision 2026-08-15).
 */
export async function listLearnerCourses(
  identity: LearnerIdentity,
  now = new Date()
): Promise<LearnerShelfEntry[]> {
  const db = adminClient();

  const [{ data: enrollmentRows }, staff, settings] = await Promise.all([
    db
      .from("lms_enrollments")
      .select("id, course_id, started_at, source, order_ref")
      .eq("auth_user_id", identity.authUserId),
    isStaff(identity.authUserId),
    getLearnerSettings(identity.authUserId),
  ]);

  const enrollmentByCourse = new Map((enrollmentRows ?? []).map((row) => [row.course_id, row]));

  const entries = await Promise.all(
    listCourses().map(async (course): Promise<LearnerShelfEntry | null> => {
      const enrollment = enrollmentByCourse.get(course.id);

      // A draft is visible to staff, and to anyone holding a manual grant — the
      // grant IS the enrollment row, so its presence is the check.
      if (course.status !== "published" && !enrollment && !staff) return null;

      if (enrollment) {
        const progress = await loadProgress(enrollment.id);
        const learner = { startedAt: new Date(enrollment.started_at), timeZone: settings.timeZone, now };
        const current = resolveCurrentLesson(course, progress, learner);

        return {
          course,
          access: "enrolled",
          lockReason: null,
          startedAt: enrollment.started_at,
          standing: summarizeStanding(course, progress, learner),
          currentLessonSlug: current?.slug ?? null,
          currentLessonTitle: current?.title ?? null,
        };
      }

      const entitlement = await checkEntitlement(identity, course, now);

      return {
        course,
        access: entitlement.entitled ? "available" : "locked",
        lockReason: entitlement.entitled ? null : entitlement.reason === "expired" ? "expired" : "not_entitled",
        startedAt: null,
        standing: null,
        currentLessonSlug: null,
        currentLessonTitle: null,
      };
    })
  );

  return entries.filter((entry): entry is LearnerShelfEntry => entry !== null);
}

export type LearnerCourseContext = {
  course: Course;
  enrollment: EnrollmentRecord;
  progress: CourseProgress;
  timeZone: string;
};

/**
 * One call for the common case: resolve course, entitlement, enrollment,
 * progress and timezone for a signed-in learner.
 */
export async function loadLearnerCourse(
  identity: LearnerIdentity,
  courseSlug: string,
  now = new Date()
): Promise<
  | { ok: true; context: LearnerCourseContext }
  | { ok: false; reason: "course_not_found" | "not_entitled" | "expired" | "not_published" }
> {
  const course = getCourse(courseSlug);
  if (!course) return { ok: false, reason: "course_not_found" };

  if (course.status !== "published") {
    // A draft opens for two kinds of people: staff, and anyone who was handed an
    // explicit manual grant. The manual grant IS the act of authorising a
    // preview, so reviewing unpublished content never requires making a
    // reviewer an admin (`npm run lms:grant`).
    const [staff, granted] = await Promise.all([
      isStaff(identity.authUserId),
      hasManualGrant(identity.authUserId, course.id),
    ]);
    if (!staff && !granted) return { ok: false, reason: "not_published" };
  }

  // Claim any purchases still keyed only by email. Cheap, idempotent, and it
  // makes the LMS self-sufficient rather than depending on the sign-in surface
  // having called /api/platform/users/sync first.
  try {
    await linkPurchasesToAccount({
      authUserId: identity.authUserId,
      email: identity.email,
      emailVerified: identity.emailVerified,
    });
  } catch (error) {
    // Entitlement still resolves through the email fallback below.
    console.warn("lms_link_purchases_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const result = await ensureEnrollment(identity, course, now);
  if (!result.enrollment) return { ok: false, reason: result.reason };

  const [progress, settings] = await Promise.all([
    loadProgress(result.enrollment.id),
    getLearnerSettings(identity.authUserId),
  ]);

  return {
    ok: true,
    context: {
      course,
      enrollment: result.enrollment,
      progress,
      timeZone: settings.timeZone,
    },
  };
}
