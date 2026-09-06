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

  /* THE DIFFERENCE THE SAVE ITSELF CREATES. The editors prune on the way out —
     an empty paragraph, a blank «+ Ще один» row — so a successfully saved
     course does not equal the working copy that produced it. Compared raw, that
     made every entry open with «Відновити незбережені зміни?» over changes
     nobody had lost. */
  it("ignores a copy that differs only by what the save would prune", () => {
    const withBlankRow = { ...course, results: [...(course.results ?? []), "  "] };
    expect(classifyDurableDraft(draft(4, withBlankRow), course, 4)).toEqual({ kind: "none" });
  });

  it("does not offer another account's draft to this one", () => {
    const theirs = { ...draft(4), ownerId: "author-1" };
    expect(classifyDurableDraft(theirs, course, 4, "author-2")).toEqual({ kind: "none" });
    expect(classifyDurableDraft(theirs, course, 4, "author-1")).toMatchObject({ kind: "recover" });
  });

  it("offers a draft while the session is still unknown, rather than losing it", () => {
    expect(classifyDurableDraft({ ...draft(4), ownerId: "author-1" }, course, 4, null)).toMatchObject({
      kind: "recover",
    });
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
