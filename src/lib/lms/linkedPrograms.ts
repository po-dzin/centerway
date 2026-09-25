import "server-only";

import { countLessons, isLinkedModule, type Course } from "@/lms-core";

import { getLiveCourse } from "./liveCatalog";
import { checkEntitlement, type LearnerIdentity } from "./server";

/**
 * THE PROGRAMS A COURSE CARRIES INSIDE IT (2026-09-25).
 *
 * A linked module (`CourseModule.linkedCourseSlug`) holds no lessons: it points
 * at another program — «Розвантажувальний день» in the materials of Шлях 21.
 * This resolves each one for one learner: what it is, and whether THEY may open
 * it. The answer is the linked course's own access, never the parent's: the
 * self-paced Шлях 21 buyer sees the module and finds it closed, the group buyer
 * finds it open, and someone who bought Reset Day on its own finds it open too.
 *
 * A link to a course that is gone or not published is dropped, not shown as a
 * dead card: the parent must never advertise something nobody can reach.
 */

export type LinkedProgram = {
  moduleId: string;
  /** The module's own title — what the parent's author calls it here. */
  title: string;
  courseSlug: string;
  /** Where the program is sold; a closed card leads to its formats. */
  programSlug: string;
  courseTitle: string;
  kind: Course["kind"] | null;
  lessonCount: number;
  cover: { src: string; alt: string } | null;
  access: "open" | "locked";
};

export async function loadLinkedPrograms(
  identity: LearnerIdentity | null,
  course: Course,
  now = new Date(),
): Promise<LinkedProgram[]> {
  const linked = course.modules.filter(isLinkedModule).sort((a, b) => a.order - b.order);
  if (linked.length === 0) return [];

  const resolved = await Promise.all(
    linked.map(async (module) => {
      const target = await getLiveCourse(module.linkedCourseSlug!).catch(() => null);
      if (!target || target.status !== "published") return null;
      const entitlement = identity ? await checkEntitlement(identity, target, now).catch(() => null) : null;
      const program: LinkedProgram = {
        moduleId: module.id,
        title: module.title,
        courseSlug: target.slug,
        programSlug: target.programSlug,
        courseTitle: target.title,
        kind: target.kind ?? null,
        lessonCount: countLessons(target),
        cover: target.cover ? { src: target.cover.mobileSrc ?? target.cover.src, alt: target.cover.alt } : null,
        access: entitlement?.entitled ? "open" : "locked",
      };
      return program;
    }),
  );
  return resolved.filter((entry): entry is LinkedProgram => entry !== null);
}
