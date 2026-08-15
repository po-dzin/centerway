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
import {
  DEFAULT_TIMEZONE,
  foldProgress,
  resolveEntitlement,
  resolveTimeZone,
  type Course,
  type CourseProgress,
  type ProgressEvent,
  type ProgressEventType,
} from "@/lms-core";
import { getCourse } from "./catalog";

export type LearnerIdentity = {
  authUserId: string;
  email: string | null;
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

  // Purchases made before the account existed are matched by email — the same
  // fallback the profile API uses.
  if (identity.email) {
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
 */
export async function checkEntitlement(
  identity: LearnerIdentity,
  course: Course,
  now = new Date()
): Promise<ReturnType<typeof resolveEntitlement>> {
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
  if (course.status !== "published") return { ok: false, reason: "not_published" };

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
