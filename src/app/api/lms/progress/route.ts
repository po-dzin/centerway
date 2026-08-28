/**
 * POST /api/lms/progress — append progress events.
 *
 * Accepts a BATCH of events, because that is the shape an offline client will
 * eventually flush (H4). Every event carries a client-generated `clientId`, so
 * replaying the same batch is a no-op rather than duplicate progress.
 *
 * Body: { courseSlug, events: [{ clientId, type, lessonSlug, occurredAt?, payload? }] }
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { LMS_LEARNER_WRITE } from "@/lib/lms/rateRules";
import { loadLearnerCourse, loadProgress, recordProgressEvent } from "@/lib/lms/server";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import {
  buildOutline,
  canCompleteLesson,
  findLesson,
  lessonAvailability,
  summarizeStanding,
  type ProgressEventType,
} from "@/lms-core";

export const runtime = "nodejs";

const ALLOWED_TYPES: ProgressEventType[] = [
  "lesson.started",
  "lesson.completed",
  // Un-completing carries no checklist gate: the gate guards claiming a step is
  // done, not withdrawing that claim. Availability still applies below.
  "lesson.uncompleted",
  "checklist.toggled",
];
const MAX_EVENTS_PER_BATCH = 100;

const FAILURE_STATUS: Record<string, number> = {
  course_not_found: 404,
  not_published: 404,
  not_entitled: 403,
  expired: 403,
};

type IncomingEvent = {
  clientId?: unknown;
  type?: unknown;
  lessonSlug?: unknown;
  occurredAt?: unknown;
  payload?: { itemId?: unknown; checked?: unknown };
};

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Keyed by learner, not by address: a batch is already the offline flush
  // shape, so the ceiling has to bound a loop rather than a person reading.
  const limit = await enforceRateLimit(req, LMS_LEARNER_WRITE, user.id);
  if (!limit.allowed) return tooManyRequests(limit.retryAfter);

  let body: { courseSlug?: unknown; events?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug : "";
  if (!courseSlug) return NextResponse.json({ error: "missing_course_slug" }, { status: 400 });

  const events = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : null;
  if (!events || events.length === 0) {
    return NextResponse.json({ error: "missing_events" }, { status: 400 });
  }
  if (events.length > MAX_EVENTS_PER_BATCH) {
    return NextResponse.json({ error: "too_many_events" }, { status: 413 });
  }

  const now = new Date();
  const result = await loadLearnerCourse({ authUserId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) }, courseSlug, now);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: FAILURE_STATUS[result.reason] ?? 400 });
  }

  const { course, enrollment, progress, timeZone } = result.context;
  const learner = { startedAt: enrollment.startedAt, timeZone, now };
  const rejected: Array<{ clientId: string; reason: string }> = [];
  let accepted = 0;

  for (const event of events) {
    const clientId = typeof event.clientId === "string" ? event.clientId.trim() : "";
    const type = event.type as ProgressEventType;
    const lessonSlug = typeof event.lessonSlug === "string" ? event.lessonSlug : "";

    if (!clientId) {
      rejected.push({ clientId: "", reason: "missing_client_id" });
      continue;
    }
    if (!ALLOWED_TYPES.includes(type)) {
      rejected.push({ clientId, reason: "unknown_type" });
      continue;
    }

    const found = findLesson(course, lessonSlug);
    if (!found) {
      rejected.push({ clientId, reason: "lesson_not_found" });
      continue;
    }

    // A locked lesson accepts no progress, however the client got there.
    if (!lessonAvailability(course, found.lesson, progress, learner).available) {
      rejected.push({ clientId, reason: "lesson_locked" });
      continue;
    }

    // Completion respects the checklist gate declared by the content itself.
    if (type === "lesson.completed") {
      const gate = canCompleteLesson(course, found.lesson, progress, learner);
      if (!gate.allowed) {
        rejected.push({ clientId, reason: gate.reason });
        continue;
      }
    }

    const payload =
      type === "checklist.toggled"
        ? {
            itemId: typeof event.payload?.itemId === "string" ? event.payload.itemId : undefined,
            checked: Boolean(event.payload?.checked),
          }
        : undefined;

    if (type === "checklist.toggled" && !payload?.itemId) {
      rejected.push({ clientId, reason: "missing_item_id" });
      continue;
    }

    const occurredAt =
      typeof event.occurredAt === "string" && !Number.isNaN(Date.parse(event.occurredAt))
        ? event.occurredAt
        : now.toISOString();

    await recordProgressEvent({
      enrollmentId: enrollment.id,
      lessonId: found.lesson.id,
      type,
      clientId,
      occurredAt,
      payload,
    });
    accepted += 1;
  }

  // Re-fold from the log so the client gets authoritative state, not a guess.
  const updated = await loadProgress(enrollment.id);

  return NextResponse.json({
    accepted,
    rejected,
    standing: summarizeStanding(course, updated, learner),
    outline: buildOutline(course, updated, learner).map((entry) => ({
      lessonId: entry.lesson.id,
      slug: entry.lesson.slug,
      completed: entry.completed,
      availability: entry.availability,
    })),
  });
}
