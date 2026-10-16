import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";

function activityTime(course: LearnerShelfCourseDto): number {
  const value = course.lastActivityAt ?? course.startedAt;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The courses this person actually holds — what the cabinet counts and shows.
 *
 * A free course is open to everyone, so the shelf lists it as `available` for
 * every account, signed in a minute ago or not. That is right for the library
 * and wrong here: an empty cabinet greeted the newcomer with «1 курс» and a
 * course they never chose (G, 2026-10-16). A free course becomes theirs when
 * they start it — that writes the enrollment row, and from then on it is
 * `enrolled` like any other.
 */
export function heldCourses(courses: LearnerShelfCourseDto[]): LearnerShelfCourseDto[] {
  return courses.filter(
    (course) =>
      course.access !== "locked" &&
      !(course.access === "available" && course.source === "free" && course.startedAt === null),
  );
}

/**
 * Picks the one course the profile should offer to resume.
 *
 * The shelf catalogue has no recency meaning, so its array order must never
 * decide this card. Among unfinished enrolled courses, the latest persisted
 * learner activity wins. A paid but unopened course remains the fallback.
 */
export function pickResumeCourse(courses: LearnerShelfCourseDto[]): LearnerShelfCourseDto | null {
  const active = [...courses]
    .filter(
      (course) => course.access === "enrolled" && !course.standing?.isFinished && Boolean(course.currentLessonSlug),
    )
    .sort((left, right) => activityTime(right) - activityTime(left));

  return (
    active[0] ??
    courses.find((course) => course.access === "available") ??
    [...courses].sort((left, right) => activityTime(right) - activityTime(left))[0] ??
    null
  );
}
