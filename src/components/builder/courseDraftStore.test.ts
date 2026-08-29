import { describe, expect, it } from "vitest";

import { getSnapshotCourse } from "@/lib/lms/catalog";
import { acknowledgedDraftRecord, classifyDurableDraft, type DurableCourseDraft } from "./courseDraftStore";

const course = getSnapshotCourse("reset-day")!;
const local = { ...course, title: `${course.title} · локально` };

function draft(baseGeneration: number, value = local): DurableCourseDraft {
  return {
    courseId: course.id,
    course: value,
    baseGeneration,
    snapshotId: "snapshot-1",
    writerId: "writer-1",
    updatedAt: 1,
  };
}

describe("classifyDurableDraft", () => {
  it("recovers an unsent draft from the current server generation", () => {
    expect(classifyDurableDraft(draft(4), course, 4)).toMatchObject({ kind: "recover" });
  });

  it("keeps a stale-generation draft isolated for conflict recovery", () => {
    expect(classifyDurableDraft(draft(3), course, 4)).toMatchObject({ kind: "conflict" });
  });

  it("ignores an acknowledged copy equal to the server", () => {
    expect(classifyDurableDraft(draft(3, course), course, 4)).toEqual({ kind: "none" });
  });
});

describe("acknowledgedDraftRecord", () => {
  const accepted = { writerId: "writer-1", snapshotId: "snapshot-1", previousGeneration: 4, nextGeneration: 5 };

  it("clears the exact snapshot accepted by the server", () => {
    expect(acknowledgedDraftRecord(draft(4), accepted)).toBeNull();
  });

  it("keeps a newer local snapshot and rebases it after an older save returns", () => {
    expect(acknowledgedDraftRecord({ ...draft(4), snapshotId: "snapshot-2" }, accepted)).toMatchObject({
      snapshotId: "snapshot-2",
      baseGeneration: 5,
    });
  });

  it("never changes a record written by another tab", () => {
    const other = { ...draft(4), writerId: "writer-2" };
    expect(acknowledgedDraftRecord(other, accepted)).toBe(other);
  });
});
