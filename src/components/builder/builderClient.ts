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
import type { Course, CourseTheme, Lesson, ReadinessBlocker } from "@/lms-core";
import type { LessonDocumentFormat } from "@/lib/lms/lessonDocuments";

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
  /** `course` may be the next version; this is the release learners still see. */
  liveStatus: Course["status"];
  hasPendingRevision: boolean;
  updatedAt: string | null;
  readiness: { ready: boolean; blockers: ReadinessBlocker[] };
  review: { status: "draft" | "in_review" | "changes_requested" | "approved"; note: string | null; enabled: boolean };
  slugEditable: boolean;
};

export type CourseImportPreview = {
  sourceSlug: string;
  slug: string;
  title: string;
  locale: Course["locale"];
  moduleCount: number;
  lessonCount: number;
  blockCount: number;
  blockerCount: number;
  blockers: ReadinessBlocker[];
  changes: string[];
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
        // Only for a JSON body. A FormData body must carry the browser's own
        // multipart boundary, and naming a content-type here overwrites it —
        // the server then cannot find where one part ends and the next begins.
        ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
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

export function createCourse(): Promise<BuilderResult<{ slug: string }>> {
  return request("/api/lms/authoring/courses", { method: "POST", body: "{}" });
}

export function submitCourseForReview(slug: string): Promise<BuilderResult<{ status: "in_review" }>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}/review`, { method: "POST" });
}

export function previewCourseImport(course: unknown): Promise<BuilderResult<{ preview: CourseImportPreview }>> {
  return request("/api/lms/authoring/import", {
    method: "POST",
    body: JSON.stringify({ course, commit: false }),
  });
}

export function commitCourseImport(course: unknown): Promise<BuilderResult<{ slug: string }>> {
  return request("/api/lms/authoring/import", {
    method: "POST",
    body: JSON.stringify({ course, commit: true }),
  });
}

/** Download uses the same Bearer boundary but keeps the response as text. */
export async function exportCourseFile(
  slug: string,
): Promise<BuilderResult<{ filename: string; text: string }>> {
  const token = await accessToken();
  if (!token) return { ok: false, failure: "unauthenticated" };

  let response: Response;
  try {
    response = await fetch(`/api/lms/authoring/courses/${encodeURIComponent(slug)}/export`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, failure: "network" };
  }

  if (response.status === 401) return { ok: false, failure: "unauthenticated" };
  if (response.status === 403) return { ok: false, failure: "forbidden" };
  if (response.status === 404) return { ok: false, failure: "not_found" };
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, failure: response.status === 422 ? "invalid" : "network", detail: payload?.error };
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${slug}.json`;
  return { ok: true, data: { filename, text: await response.text() } };
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
): Promise<BuilderResult<{ slug: string; status: Course["status"]; blockers: ReadinessBlocker[]; staged?: true }>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify({ course }),
  });
}

export function renameCourseSlug(slug: string, nextSlug: string): Promise<BuilderResult<{ slug: string }>> {
  return request(`/api/lms/authoring/courses/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify({ slug: nextSlug }),
  });
}

/**
 * Sends one image and gets back the address it now lives at.
 *
 * A FormData body, so `request`'s JSON content-type must not be set — which is
 * why the header is left off when the body is not a string. The browser writes
 * its own multipart boundary and getting in the way of that breaks the parse on
 * the other side.
 */
export function uploadMedia(courseSlug: string, file: File): Promise<BuilderResult<{ src: string; path: string }>> {
  const body = new FormData();
  body.set("courseSlug", courseSlug);
  body.set("file", file);
  return request("/api/lms/authoring/media", { method: "POST", body });
}

export function importLessonFiles(courseSlug: string, files: File[]): Promise<BuilderResult<{ lessons: Lesson[] }>> {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  return request(`/api/lms/authoring/courses/${encodeURIComponent(courseSlug)}/lessons/import`, {
    method: "POST",
    body,
  });
}

export async function exportLessonFile(
  courseSlug: string,
  lesson: Lesson,
  format: LessonDocumentFormat,
): Promise<BuilderResult<{ filename: string; blob: Blob }>> {
  const token = await accessToken();
  if (!token) return { ok: false, failure: "unauthenticated" };

  let response: Response;
  try {
    response = await fetch(`/api/lms/authoring/courses/${encodeURIComponent(courseSlug)}/lessons/export`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ lesson, format }),
    });
  } catch {
    return { ok: false, failure: "network" };
  }

  if (response.status === 401) return { ok: false, failure: "unauthenticated" };
  if (response.status === 403) return { ok: false, failure: "forbidden" };
  if (response.status === 404) return { ok: false, failure: "not_found" };
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, failure: response.status === 422 ? "invalid" : "network", detail: payload?.error };
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${lesson.slug}.${format}`;
  return { ok: true, data: { filename, blob: await response.blob() } };
}
