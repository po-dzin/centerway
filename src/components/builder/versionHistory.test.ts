import { describe, expect, it } from "vitest";

import { getSnapshotCourse } from "@/lib/lms/catalog";
import { courseShape, REVISION_KIND_LABELS } from "./versionHistory";

describe("builder version history", () => {
  it("summarizes a stored course without treating modules as lessons", () => {
    const resetDay = getSnapshotCourse("reset-day");
    expect(resetDay).not.toBeNull();
    if (!resetDay) return;
    expect(courseShape(resetDay)).toEqual({
      modules: resetDay.modules.length,
      lessons: resetDay.modules.reduce((total, module) => total + module.lessons.length, 0),
      blocks: resetDay.modules.reduce(
        (total, module) => total + module.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.blocks.length, 0),
        0,
      ),
    });
  });

  it("has author-facing copy for every journal kind", () => {
    expect(Object.keys(REVISION_KIND_LABELS).sort()).toEqual(
      ["autosave_checkpoint", "manual", "published", "restored", "review_submitted"].sort(),
    );
  });
});
