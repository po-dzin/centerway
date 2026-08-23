import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";

function activityTime(course: LearnerShelfCourseDto): number {
  const value = course.lastActivityAt ?? course.startedAt;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Picks the one course the profile should offer to resume.
 *
 * The shelf catalogue has no recency meaning, so its array order must never
 * decide this card. Among unfinished enrolled courses, the latest persisted
 * learner activity wins. A paid but unopened course remains the fallback.
 */
export function pickResumeCourse(
  courses: LearnerShelfCourseDto[],
): LearnerShelfCourseDto | null {
  const active = [...courses]
    .filter(
      (course) =>
        course.access === "enrolled" &&
        !course.standing?.isFinished &&
        Boolean(course.currentLessonSlug),
    )
    .sort((left, right) => activityTime(right) - activityTime(left));

  return (
    active[0] ??
    courses.find((course) => course.access === "available") ??
    [...courses].sort((left, right) => activityTime(right) - activityTime(left))[0] ??
    null
  );
}
