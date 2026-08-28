/**
 * Rate limits for /api/lms/*.
 *
 * There were none until 2026-08-28, and while the only caller was the builder
 * that was defensible: an author holds down a key, the editor debounces to one
 * save per 1.5s, and the ceiling is a human wrist. The agent contour removes
 * that ceiling — a tool loop retries in milliseconds and does not get tired
 * (docs/agent-contour-2026-08-21.md §8).
 *
 * THE NUMBERS ARE HEADROOM OVER THE BUILDER, NOT GUESSES. Autosave fires at
 * most every 1.5s (`useCourseAutosave.ts`), so continuous typing costs about 40
 * writes a minute; the write rule allows three times that. A limit that a real
 * author can reach by working normally is a bug that looks like abuse
 * prevention, and it would surface as lost work in an editor.
 *
 * All of these are keyed by user id (see `enforceRateLimit`), so one author
 * hitting a ceiling never throttles another on the same address.
 */

import type { RateLimitRule } from "@/lib/rateLimit";

/** Saves, renames, deletes, review submissions, revision writes. */
export const LMS_COURSE_WRITE: RateLimitRule = {
  name: "lms_course_write",
  limit: 120,
  windowSeconds: 60,
};

/**
 * Creating a course or importing one. Rare by nature and expensive by row
 * count, so it is bounded per hour rather than per minute: twenty new courses
 * in an hour is not authoring.
 */
export const LMS_COURSE_CREATE: RateLimitRule = {
  name: "lms_course_create",
  limit: 20,
  windowSeconds: 3600,
};

/** Uploading media into a lesson. */
export const LMS_MEDIA_UPLOAD: RateLimitRule = {
  name: "lms_media_upload",
  limit: 120,
  windowSeconds: 3600,
};

/**
 * Reads, including exports. Loose on purpose — the builder reads on every
 * navigation and the learner's cabinet reads on every lesson — but not absent,
 * because a tool loop that reads a course ten times a second is exactly the
 * failure this file exists to bound.
 */
export const LMS_AUTHORING_READ: RateLimitRule = {
  name: "lms_authoring_read",
  limit: 600,
  windowSeconds: 60,
};

/** Learner writes: progress ticks and reader annotations. */
export const LMS_LEARNER_WRITE: RateLimitRule = {
  name: "lms_learner_write",
  limit: 120,
  windowSeconds: 60,
};
