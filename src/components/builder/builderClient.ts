"use client";

/**
 * Browser-side access to /api/lms/authoring/*.
 *
 * Same shape as the learner's `lmsClient` — a thin Bearer wrapper, not server
 * data loading — for the same reason: the contract the builder calls is the
 * contract the author's agent will call (H3), so a second client stays a
 * renderer instead of a second implementation.
 */

import { supabaseClient } from "@/lib/supabaseClient";
import type { Course, CourseTheme, ReadinessBlocker } from "@/lms-core";

export type BuilderFailure = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "network";

export type BuilderCourseSummary = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  authorId: string | null;
  moduleCount: number;
  lessonCount: number;
  /** -1 means the stored rows do not currently form a valid course. */
  blockerCount: number;
  updatedAt: string | null;
  cover: { src: string; alt: string } | null;
  theme: CourseTheme | null;
  sortOrder: number | null;
};

export type BuilderCourseDto = {
  course: Course;
  updatedAt: string | null;
  readiness: { ready: boolean; blockers: ReadinessBlocker[] };
};

export type BuilderResult<T> = { ok: true; data: T } | { ok: false; failure: BuilderFailure; detail?: string };

async function accessToken(): Promise<string | null> {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<BuilderResult<T>> {
  const token = await accessToken();
  if (!token) return { ok: false, failure: "unauthenticated" };

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, failure: "network" };
  }

  if (response.status === 401) return { ok: false, failure: "unauthenticated" };
  if (response.status === 403) return { ok: false, failure: "forbidden" };
  if (response.status === 404) return { ok: false, failure: "not_found" };

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (response.status === 422) {
    // The author's own error — a validation code or a readiness gate refusal.
    // Carried through verbatim: `lms_block_missing_text:way21.week-1.day-2
    // .blocks[3]` names the exact place, and softening it into "щось не так"
    // would throw away the only useful part.
    return { ok: false, failure: "invalid", detail: payload?.error };
  }

  if (!response.ok || !payload) {
    return { ok: false, failure: "network", detail: payload?.error };
  }

  return { ok: true, data: payload };
}

export function listCourses(): Promise<
  BuilderResult<{ courses: BuilderCourseSummary[]; isAdmin: boolean; canCreate: boolean }>
> {
  return request("/api/lms/authoring/courses");
}

export function createCourse(input: {
  title: string;
  programSlug: string;
  template: string;
  palette: string;
}): Promise<BuilderResult<{ slug: string }>> {
  return request("/api/lms/authoring/courses", { method: "POST", body: JSON.stringify(input) });
}

export function deleteCourse(slug: string): Promise<BuilderResult<{ ok: true }>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

/**
 * Writes the whole order, not one moved card.
 *
 * "Move up" is a statement about the sequence: sending only the moved slug
 * would leave two courses claiming the same position and the shelf would then
 * fall back to sorting by title — the order the author just changed.
 */
export function reorderCourses(slugs: string[]): Promise<BuilderResult<{ ok: true }>> {
  return request("/api/lms/authoring/courses", { method: "PATCH", body: JSON.stringify({ slugs }) });
}

export function loadCourse(slug: string): Promise<BuilderResult<BuilderCourseDto>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}`);
}

export function saveCourse(
  slug: string,
  course: Course
): Promise<BuilderResult<{ slug: string; status: Course["status"]; blockers: ReadinessBlocker[] }>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify({ course }),
  });
}
