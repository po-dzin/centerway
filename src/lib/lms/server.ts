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
  accessRuleOf,
  accessStateOf,
  acceptedPaidOrders,
  daysRemaining,
  foldProgress,
  isEnrollmentExpired,
  planAccess,
  resolveCurrentLesson,
  resolveEntitlement,
  resolveTimeZone,
  summarizeStanding,
  type AccessRule,
  type AccessState,
  type Course,
  type CourseProgress,
  type CourseStandingSummary,
  type PaidOrderRef,
  type ProgressEvent,
  type ProgressEventType,
} from "@/lms-core";
import { linkPurchasesToAccount } from "@/lib/platform/linkPurchases";
import { getLiveCourse, listLiveCourses } from "./liveCatalog";

/**
 * Staff may open draft courses; buyers may not.
 *
 * Reads `user_roles`, like every other authorisation in this codebase. It used
 * to read `platform_users.role` — the other, unsynchronised store — which made
 * this the single place where "who is staff" could answer differently from
 * "who is admin", and, worse, the only reader of a column any signed-in user
 * could write on their own row. Switching it changed access for nobody (the
 * two stores agreed for every elevated account), which is what made it safe to
 * do immediately; the column itself was dropped the same day.
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
 *
 * A grant past its deadline is not a grant: otherwise a time-boxed reviewer
 * would keep the draft open forever, which is the one thing the deadline was
 * set to prevent.
 */
async function hasManualGrant(authUserId: string, courseId: string, now = new Date()): Promise<boolean> {
  const db = adminClient();
  const { data } = await db
    .from("lms_enrollments")
    .select("source, expires_at, status, blocked_at")
    .eq("auth_user_id", authUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (data?.source !== "manual") return false;
  return accessStateOf(
    { status: data.status, blockedAt: data.blocked_at, expiresAt: data.expires_at },
    now
  ) === "active";
}

/** An author may inspect their own unpublished work in the learner surface. */
async function isCourseAuthor(authUserId: string, courseId: string): Promise<boolean> {
  const db = adminClient();
  const { data } = await db
    .from("lms_courses")
    .select("author_id")
    .eq("id", courseId)
    .maybeSingle();

  return data?.author_id === authUserId;
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
  /** Deadline for this person on this course; `null` means access does not end. */
  expiresAt: string | null;
  /** `revoked` is an operator's decision; expiry is derived from the date above. */
  status: "active" | "revoked";
  /** Set when this person is banned from this course — no purchase lifts it. */
  blockedAt: string | null;
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

  const purchases = await loadPurchases(identity);
  if (purchases.orders.length === 0) return { entitled: false, reason: "no_paid_order" };

  return resolveEntitlement({
    courseProductCodes: course.entitlementProductCodes,
    courseSlug: course.slug,
    orders: purchases.orders,
    tokens: purchases.tokens,
    now,
  });
}

/**
 * Everything this learner has PAID that could bear on this course, unfiltered.
 *
 * Split out of `checkEntitlement` because the access planner needs the whole
 * history, not the one order that first granted the course: renewal is decided
 * by the NEWEST purchase, and the yes/no answer cannot carry it.
 */
async function loadPurchases(
  identity: LearnerIdentity
): Promise<{ orders: PaidOrderRef[]; tokens: Array<{ orderRef: string; used: boolean; expiresAt: string | null }> }> {
  const db = adminClient();
  const customerIds = await findCustomerIds(identity);
  if (customerIds.length === 0) return { orders: [], tokens: [] };

  const ordersResult = await db
    .from("orders")
    .select("order_ref, product_code, status, created_at")
    .in("customer_id", customerIds);

  const orders: PaidOrderRef[] = (ordersResult.data ?? []).map((order) => ({
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

  return { orders, tokens };
}

/**
 * The term of access this course is sold with.
 *
 * Read from the OFFER, not from the course: how long access lasts is bought and
 * sold, so it sits beside the price under the owner's admin-only policy rather
 * than in the builder where an author could lengthen what they are paid for
 * (2026-08-26 access-windows migration).
 *
 * A course with no offer row — everything granted by hand, and the six legacy
 * programs — has no term, and `planAccess` reads that as perpetual. That is the
 * pre-migration behaviour and the safe direction: an unconfigured offer must
 * never lock out someone who has paid.
 */
async function readAccessRule(course: Course): Promise<AccessRule | null> {
  const db = adminClient();
  const { data } = await db
    .from("lms_course_offers")
    .select("access_days, access_lifetime, active")
    .eq("course_id", course.id)
    .eq("active", true)
    .maybeSingle();

  if (!data) return null;
  return accessRuleOf({
    accessDays: (data.access_days as number | null) ?? null,
    accessLifetime: (data.access_lifetime as boolean | null) ?? null,
  });
}

/** The columns every enrollment read selects, so all of them fold the same way. */
const ENROLLMENT_COLUMNS =
  "id, course_id, started_at, source, order_ref, expires_at, status, revoked_at, blocked_at";

type EnrollmentRow = {
  id: string;
  course_id: string;
  started_at: string;
  source: EnrollmentRecord["source"];
  order_ref: string | null;
  expires_at: string | null;
  status?: string | null;
  revoked_at?: string | null;
  blocked_at?: string | null;
};

function toEnrollmentRecord(row: EnrollmentRow): EnrollmentRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    startedAt: new Date(row.started_at),
    source: row.source,
    orderRef: row.order_ref,
    expiresAt: row.expires_at ?? null,
    status: row.status === "revoked" ? "revoked" : "active",
    blockedAt: row.blocked_at ?? null,
  };
}

/** Why a door stayed shut. Every value is a 403 to the learner and a different sentence to support. */
export type AccessDenial = "not_entitled" | "expired" | "revoked" | "blocked";

function denialFor(state: AccessState): AccessDenial {
  return state === "active" ? "not_entitled" : state;
}

/**
 * Returns the learner's enrollment, opening or renewing the access window.
 *
 * This is the ONE door. The course page, the lesson page and every progress
 * write pass through here, so what this function refuses, the platform refuses
 * — there is no second place where a direct link could be luckier.
 *
 * TWO CLOCKS, ON PURPOSE, and the difference is the whole design:
 *
 *   · `started_at` is DAY 1 OF THE DRIP and begins when the learner first opens
 *     the course. Buying on Friday and starting on Sunday must not burn two
 *     days of a three-day protocol (decision 2026-08-15).
 *
 *   · `expires_at` is THE END OF WHAT WAS BOUGHT and is counted from the
 *     PAYMENT, per the offer's term. It is what the buyer paid for and what the
 *     admin panel and the receipt both have to agree with.
 *
 * Access is refused for four different reasons and they are never merged: a
 * lapsed window (`expired`) is fixed by paying again, a revoke is fixed by
 * paying again OR by an operator, and a ban is fixed by an operator alone.
 */
export async function ensureEnrollment(
  identity: LearnerIdentity,
  course: Course,
  now = new Date()
): Promise<{ enrollment: EnrollmentRecord } | { enrollment: null; reason: AccessDenial }> {
  const db = adminClient();

  const existing = await db
    .from("lms_enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("course_id", course.id)
    .eq("auth_user_id", identity.authUserId)
    .maybeSingle();

  const row = (existing.data as EnrollmentRow | null) ?? null;

  // A ban is answered before anything is read or planned: no purchase, no
  // staff role and no offer term lifts it.
  if (row?.blocked_at) return { enrollment: null, reason: "blocked" };

  const [rule, purchases, staff] = await Promise.all([
    readAccessRule(course),
    loadPurchases(identity),
    isStaff(identity.authUserId),
  ]);

  const orders = acceptedPaidOrders({
    courseProductCodes: course.entitlementProductCodes,
    courseSlug: course.slug,
    orders: purchases.orders,
    tokens: purchases.tokens,
    now,
  });

  const plan = planAccess({
    orders,
    rule,
    now,
    existing: row
      ? {
          orderRef: row.order_ref,
          expiresAt: row.expires_at ?? null,
          status: row.status ?? "active",
          revokedAt: row.revoked_at ?? null,
          blockedAt: row.blocked_at ?? null,
        }
      : null,
  });

  if (row) {
    // A purchase made since the current window was anchored renews the seat —
    // and re-opens a revoked one, because that revoke closed the seat bought by
    // the OLD payment. A ban is the state that survives a new payment, and it
    // was already answered above.
    if (plan.grant) {
      const renewed = await db
        .from("lms_enrollments")
        .update({
          expires_at: plan.expiresAt,
          order_ref: plan.orderRef,
          status: "active",
          revoked_at: null,
          // A hand-made grant that the learner has now paid for becomes an
          // ordinary purchase; the audit log keeps the record of the gift.
          source: row.source === "manual" ? "order" : row.source,
          updated_at: now.toISOString(),
        })
        .eq("id", row.id)
        .select(ENROLLMENT_COLUMNS)
        .maybeSingle();

      const updated = (renewed.data as EnrollmentRow | null) ?? {
        ...row,
        expires_at: plan.expiresAt,
        order_ref: plan.orderRef,
        status: "active",
        revoked_at: null,
      };

      const state = accessStateOf(
        { status: updated.status, blockedAt: updated.blocked_at, expiresAt: updated.expires_at },
        now
      );
      // A renewal can still land in the past: a 30-day term bought three months
      // ago and never opened is a window that has already closed.
      if (state !== "active") return { enrollment: null, reason: denialFor(state) };
      return { enrollment: toEnrollmentRecord(updated) };
    }

    const state = accessStateOf(
      { status: row.status, blockedAt: row.blocked_at, expiresAt: row.expires_at },
      now
    );
    if (state !== "active") return { enrollment: null, reason: denialFor(state) };
    return { enrollment: toEnrollmentRecord(row) };
  }

  // No row yet. Staff open a published course without ever having paid, the
  // same way they open a draft; everyone else needs a purchase.
  if (!plan.grant && !staff) {
    const entitlement = await checkEntitlement(identity, course, now);
    return {
      enrollment: null,
      reason: entitlement.entitled ? "not_entitled" : entitlement.reason === "expired" ? "expired" : "not_entitled",
    };
  }

  const expiresAt = plan.grant ? plan.expiresAt : null;

  // Nothing is written for a window that is already shut: the row would carry
  // no progress, no history worth keeping, and would have to be stepped over on
  // every later purchase.
  if (plan.grant && isEnrollmentExpired(expiresAt, now)) {
    return { enrollment: null, reason: "expired" };
  }

  const inserted = await db
    .from("lms_enrollments")
    .insert({
      course_id: course.id,
      auth_user_id: identity.authUserId,
      source: plan.grant ? "order" : "manual",
      order_ref: plan.grant ? plan.orderRef : null,
      status: "active",
      // Day 1 is the day the learner FIRST OPENS the course, not the day they
      // paid — the deadline above is the half of this that follows the money.
      started_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (inserted.error || !inserted.data) {
    // A concurrent request may have won the unique (course_id, auth_user_id).
    const retry = await db
      .from("lms_enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("course_id", course.id)
      .eq("auth_user_id", identity.authUserId)
      .maybeSingle();

    if (!retry.data) {
      throw new Error(`lms_enrollment_insert_failed:${inserted.error?.message ?? "unknown"}`);
    }

    const raced = retry.data as EnrollmentRow;
    const state = accessStateOf(
      { status: raced.status, blockedAt: raced.blocked_at, expiresAt: raced.expires_at },
      now
    );
    if (state !== "active") return { enrollment: null, reason: denialFor(state) };
    return { enrollment: toEnrollmentRecord(raced) };
  }

  return { enrollment: toEnrollmentRecord(inserted.data as EnrollmentRow) };
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
  lockReason: AccessDenial | null;
  startedAt: string | null;
  /** When this window closes; `null` means it does not. */
  expiresAt: string | null;
  /** Whole days left, so the card can say it without re-deriving the rule. */
  daysLeft: number | null;
  /** How the seat was come by: a purchase, a hand-made grant, a bonus. */
  source: EnrollmentRecord["source"] | null;
  /** Latest real learner interaction in this course, derived from progress events. */
  lastActivityAt: string | null;
  standing: CourseStandingSummary | null;
  currentLessonSlug: string | null;
  currentLessonTitle: string | null;
};

/**
 * Every course this account can see, for the cabinet shelf.
 *
 * Deliberately READ-ONLY: unlike `loadLearnerCourse`, it never creates or
 * renews an enrollment. Day 1 starts when the learner opens the course, so
 * merely landing on the cabinet must not start the clock (decision 2026-08-15).
 * It does PROJECT what opening would do — a course paid for again this morning
 * reads as available here before any row is written — because a shelf that
 * disagreed with the door it links to would be worse than one that is a second
 * behind.
 *
 * Nothing is hidden for want of access: a course nobody has bought is shown
 * locked, with its price and its offer page one tap away.
 */
export async function listLearnerCourses(
  identity: LearnerIdentity,
  now = new Date()
): Promise<LearnerShelfEntry[]> {
  const db = adminClient();

  const [{ data: enrollmentRows }, staff, settings, purchases] = await Promise.all([
    db
      .from("lms_enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("auth_user_id", identity.authUserId),
    isStaff(identity.authUserId),
    getLearnerSettings(identity.authUserId),
    loadPurchases(identity),
  ]);

  const enrollmentByCourse = new Map(
    ((enrollmentRows ?? []) as EnrollmentRow[]).map((row) => [row.course_id, row])
  );

  const courses = await listLiveCourses();

  // One read for every term rather than one per card: the shelf renders the
  // whole catalogue, and an offer lookup per course was the N+1 waiting to
  // happen once the catalogue grows past the six programs it has today.
  const { data: offerRows } = await db
    .from("lms_course_offers")
    .select("course_id, access_days, access_lifetime, active")
    .eq("active", true);

  const ruleByCourse = new Map<string, AccessRule | null>(
    ((offerRows ?? []) as Array<Record<string, unknown>>).map((row) => [
      row.course_id as string,
      accessRuleOf({
        accessDays: (row.access_days as number | null) ?? null,
        accessLifetime: (row.access_lifetime as boolean | null) ?? null,
      }),
    ])
  );

  const entries = await Promise.all(
    courses.map(async (course): Promise<LearnerShelfEntry | null> => {
      const row = enrollmentByCourse.get(course.id);

      const orders = acceptedPaidOrders({
        courseProductCodes: course.entitlementProductCodes,
        courseSlug: course.slug,
        orders: purchases.orders,
        tokens: purchases.tokens,
        now,
      });

      // What opening the course WOULD do, without doing it.
      const plan = planAccess({
        orders,
        rule: ruleByCourse.get(course.id) ?? null,
        now,
        existing: row
          ? {
              orderRef: row.order_ref,
              expiresAt: row.expires_at ?? null,
              status: row.status ?? "active",
              revokedAt: row.revoked_at ?? null,
              blockedAt: row.blocked_at ?? null,
            }
          : null,
      });

      const projected = plan.grant
        ? { status: "active", blockedAt: row?.blocked_at ?? null, expiresAt: plan.expiresAt }
        : { status: row?.status ?? "active", blockedAt: row?.blocked_at ?? null, expiresAt: row?.expires_at ?? null };

      const state = row || plan.grant ? accessStateOf(projected, now) : null;
      const open = state === "active";

      // A draft is visible to staff, and to anyone holding a manual grant — the
      // grant IS the enrollment row, so its presence is the check.
      if (course.status !== "published" && !(row && open) && !staff) return null;

      const expiresAt = projected.expiresAt ?? null;
      const shared = {
        course,
        expiresAt,
        daysLeft: daysRemaining(expiresAt, now),
        source: (row?.source ?? (plan.grant ? "order" : null)) as EnrollmentRecord["source"] | null,
      };

      // Past its deadline the row still exists — the learner keeps their
      // progress and their place — but it no longer opens the course, so the
      // shelf shows the card locked rather than pretending it is theirs.
      if (row && !open) {
        return {
          ...shared,
          access: "locked",
          lockReason: denialFor(state ?? "expired"),
          startedAt: row.started_at,
          lastActivityAt: null,
          standing: null,
          currentLessonSlug: null,
          currentLessonTitle: null,
        };
      }

      if (row && open) {
        const progress = await loadProgress(row.id);
        const learner = { startedAt: new Date(row.started_at), timeZone: settings.timeZone, now };
        const current = resolveCurrentLesson(course, progress, learner);

        return {
          ...shared,
          access: "enrolled",
          lockReason: null,
          startedAt: row.started_at,
          lastActivityAt: progress.lastActivityAt,
          standing: summarizeStanding(course, progress, learner),
          currentLessonSlug: current?.slug ?? null,
          currentLessonTitle: current?.title ?? null,
        };
      }

      // No row. Staff still open a published course, and a fresh purchase shows
      // as available before its first visit writes anything.
      const available = open || staff;
      const entitlement = available ? null : await checkEntitlement(identity, course, now);

      return {
        ...shared,
        access: available ? "available" : "locked",
        lockReason: available
          ? null
          : entitlement && !entitlement.entitled && entitlement.reason === "expired"
            ? "expired"
            : "not_entitled",
        startedAt: null,
        lastActivityAt: null,
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
  | { ok: false; reason: "course_not_found" | "not_published" | AccessDenial }
> {
  // Live, with the shipped snapshot underneath it — so an author's publish is
  // visible to a learner without a deploy, and a database that cannot answer
  // still serves the last known good copy (liveCatalog.ts).
  const course = await getLiveCourse(courseSlug);
  if (!course) return { ok: false, reason: "course_not_found" };

  if (course.status !== "published") {
    // A draft opens for two kinds of people: staff, and anyone who was handed an
    // explicit manual grant. The manual grant IS the act of authorising a
    // preview, so reviewing unpublished content never requires making a
    // reviewer an admin (`npm run lms:grant`).
    const [staff, granted, author] = await Promise.all([
      isStaff(identity.authUserId),
      hasManualGrant(identity.authUserId, course.id),
      isCourseAuthor(identity.authUserId, course.id),
    ]);
    if (!staff && !granted && !author) return { ok: false, reason: "not_published" };
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
