"use client";

/**
 * Browser-side access to /api/lms/*.
 *
 * Deliberately a thin Bearer-token fetch wrapper rather than server-component
 * data loading: the web cabinet consumes exactly the contract a native app or a
 * Telegram Mini App would call, so the second client stays a renderer instead of
 * a second implementation (docs/lms-research-2026-08-15.md §5A).
 */

import { supabaseClient } from "@/lib/supabaseClient";
import type { LessonAvailability, LessonBlock, InlineText, ProgressEventType } from "@/lms-core";

export type LmsFailure =
  | "unauthenticated"
  | "unauthorized"
  | "course_not_found"
  | "not_published"
  | "not_entitled"
  | "expired"
  | "lesson_not_found"
  | "lesson_locked"
  | "network";

export type CourseOutlineEntryDto = {
  moduleId: string;
  moduleTitle: string;
  /** Reference material — outside the numbered flow. */
  isReference: boolean;
  lessonId: string;
  slug: string;
  title: string;
  dayIndex: number | null;
  durationMin: number | null;
  completed: boolean;
  availability: LessonAvailability;
};

export type CourseViewDto = {
  course: {
    slug: string;
    title: string;
    version: number;
    locale: string;
    scheduleMode: "open" | "sequential" | "daily";
    summary: InlineText | null;
  };
  enrollment: { startedAt: string; source: string; timeZone: string };
  standing: { totalLessons: number; completedLessons: number; currentDay: number | null; isFinished: boolean };
  currentLessonSlug: string | null;
  outline: CourseOutlineEntryDto[];
};

/** One course on the cabinet shelf — outline-free, just enough to decide where to go next. */
export type LearnerShelfCourseDto = {
  slug: string;
  title: string;
  programSlug: string;
  status: "draft" | "published";
  scheduleMode: "open" | "sequential" | "daily";
  summary: string | null;
  access: "enrolled" | "available" | "locked";
  lockReason: "not_entitled" | "expired" | null;
  startedAt: string | null;
  standing: CourseViewDto["standing"] | null;
  currentLessonSlug: string | null;
  currentLessonTitle: string | null;
};

export type LearnerShelfDto = { courses: LearnerShelfCourseDto[] };

export type LessonNeighbour = { slug: string; title: string; available: boolean } | null;

export type LessonViewDto = {
  lesson: {
    id: string;
    slug: string;
    title: string;
    dayIndex: number | null;
    durationMin: number | null;
    summary: InlineText | null;
    blocks: LessonBlock[];
  };
  module: { id: string; title: string };
  courseVersion: number;
  progress: { status: "started" | "completed"; checklist: Record<string, boolean>; completedAt: string | null };
  requiredChecklistItemIds: string[];
  completion: { allowed: true } | { allowed: false; reason: "unavailable" | "checklist_incomplete" };
  isReference: boolean;
  nav: {
    /** null on reference pages — they hold no position in the sequence. */
    position: number | null;
    total: number;
    previous: LessonNeighbour;
    next: LessonNeighbour;
  };
  /** The whole course map, so the contents drawer needs no extra request. */
  outline: CourseOutlineEntryDto[];
};

export type ProgressAck = {
  accepted: number;
  rejected: Array<{ clientId: string; reason: string }>;
  standing: CourseViewDto["standing"];
  outline: Array<{ lessonId: string; slug: string; completed: boolean; availability: LessonAvailability }>;
};

export type LmsResult<T> = { ok: true; data: T } | { ok: false; error: LmsFailure; detail?: unknown };

async function accessToken(): Promise<string | null> {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<LmsResult<T>> {
  const token = await accessToken();
  if (!token) return { ok: false, error: "unauthenticated" };

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    return { ok: false, error: "network" };
  }

  if (response.ok) return { ok: true, data: (await response.json()) as T };

  const body = await response.json().catch(() => ({}));
  const error = (body as { error?: string }).error;
  const known: LmsFailure[] = [
    "unauthorized",
    "course_not_found",
    "not_published",
    "not_entitled",
    "expired",
    "lesson_not_found",
    "lesson_locked",
  ];

  return {
    ok: false,
    error: known.includes(error as LmsFailure) ? (error as LmsFailure) : "network",
    detail: body,
  };
}

const TIMEZONE_SYNC_KEY = "cw:lms:tz-synced";

/**
 * Reports the browser's timezone once per session, before the first course read.
 *
 * Drip and reminders run in the learner's calendar, so the stored zone must be
 * right before day N is computed — hence awaited rather than fired and forgotten.
 * Failure is non-fatal: the server falls back to Europe/Kyiv.
 */
export async function ensureTimeZoneSynced(): Promise<void> {
  let detected: string;
  try {
    detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return;
  }
  if (!detected) return;

  try {
    if (sessionStorage.getItem(TIMEZONE_SYNC_KEY) === detected) return;
  } catch {
    // Private mode or blocked storage — just re-send, the write is idempotent.
  }

  const result = await request<{ ok: boolean }>("/api/platform/users/me/settings", {
    method: "POST",
    body: JSON.stringify({ timezone: detected }),
  });

  if (result.ok) {
    try {
      sessionStorage.setItem(TIMEZONE_SYNC_KEY, detected);
    } catch {
      // Nothing to do — the sync simply repeats next navigation.
    }
  }
}

export function fetchMyCourses(): Promise<LmsResult<LearnerShelfDto>> {
  return request<LearnerShelfDto>("/api/lms/me/courses");
}

export function fetchCourse(slug: string): Promise<LmsResult<CourseViewDto>> {
  return request<CourseViewDto>(`/api/lms/courses/${encodeURIComponent(slug)}`);
}

export function fetchLesson(courseSlug: string, lessonSlug: string): Promise<LmsResult<LessonViewDto>> {
  return request<LessonViewDto>(
    `/api/lms/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`
  );
}

export type OutgoingProgressEvent = {
  clientId: string;
  /** Derived from the core union rather than re-listed: a new event type must
      not need to be remembered in two places. */
  type: ProgressEventType;
  lessonSlug: string;
  occurredAt: string;
  payload?: { itemId?: string; checked?: boolean };
};

export function postProgress(
  courseSlug: string,
  events: OutgoingProgressEvent[]
): Promise<LmsResult<ProgressAck>> {
  return request<ProgressAck>("/api/lms/progress", {
    method: "POST",
    body: JSON.stringify({ courseSlug, events }),
  });
}

/**
 * Idempotency key for a progress event.
 *
 * Stable per (lesson, kind, item) so a double tap or a retried request folds
 * into one event — the same guarantee an offline flush will need later.
 */
export function progressClientId(parts: {
  lessonId: string;
  kind: string;
  itemId?: string;
  stamp?: string;
}): string {
  return ["cw", parts.lessonId, parts.kind, parts.itemId ?? "-", parts.stamp ?? ""].join(":");
}
