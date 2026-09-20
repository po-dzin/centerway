import { BuilderCourseList } from "@/components/builder/BuilderCourseList";

/**
 * The workshop's materials shelf.
 *
 * It moved off `/build` on 2026-09-07, when that address became the author's
 * overview. `courses` is a reserved slug (`BUILDER_RESERVED_SLUGS`) precisely
 * because this static segment wins over `/build/[course]`.
 */
export default function BuilderCoursesPage() {
  return <BuilderCourseList />;
}
