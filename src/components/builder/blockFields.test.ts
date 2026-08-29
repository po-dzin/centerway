import { describe, expect, it } from "vitest";

import { BLOCK_TYPE_LABELS, describeBlock, readPath, writePath } from "./blockFields";
import { snapshotCourses } from "@/lib/lms/catalog";
import { LESSON_BLOCK_TYPES, type LessonBlock } from "@/lms-core";

/** Structural keys the author never edits. */
const NOT_AUTHORED = new Set(["id", "type", "provider", "kind"]);

/**
 * Fields that are DERIVED, not authored — each one with the reason, so an
 * exemption stays a statement rather than a silencer.
 *
 * `step` joined `order` and `dayIndex` on 2026-08-21. It is the block's
 * position in the day's protocol, and it was a number the author typed: insert
 * a step in the middle and every number below it was wrong, silently, because
 * the badge renders whatever the field says. `renumberSteps` owns it now.
 */
const DERIVED = new Set(["protocol_step:step"]);

function everyBlock(): LessonBlock[] {
  return snapshotCourses().flatMap((course) =>
    course.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.blocks))
  );
}

describe("block field descriptions", () => {
  it("names every block type in the vocabulary", () => {
    // A type with no label renders as `undefined` in the editor's block header.
    expect(Object.keys(BLOCK_TYPE_LABELS).sort()).toEqual([...LESSON_BLOCK_TYPES].sort());
  });

  /**
   * The claim the editor is built on, checked against real content.
   *
   * A field that is merely missing from the description is INVISIBLE in the
   * builder while still being in the data — the quietest possible way for an
   * editor to be wrong, and the one an author would never discover, because
   * nothing is displayed to look wrong.
   */
  it("exposes every authored field of every block in the shipped courses", () => {
    const missing: string[] = [];

    for (const block of everyBlock()) {
      const covered = new Set(describeBlock(block).map((field) => field.path.join(".")));

      for (const path of authoredPaths(block)) {
        const key = path.join(".");
        // Covered directly, or by a field deeper inside it (a rich_text block is
        // described node by node, not as one `content` field).
        if (DERIVED.has(`${block.type}:${key}`)) continue;
        const reachable = covered.has(key) || [...covered].some((candidate) => candidate.startsWith(`${key}.`));
        if (!reachable) missing.push(`${block.type}: ${key}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("addresses fields that actually resolve on the block", () => {
    // The mirror of the test above: a described path that reads back undefined
    // is a field the author can type into that writes somewhere nothing renders.
    for (const block of everyBlock()) {
      for (const field of describeBlock(block)) {
        const value = readPath(block, field.path);
        // Optional fields are legitimately absent; what must not happen is a
        // path whose PARENT does not exist, e.g. items[7] on a 3-item list.
        if (value === undefined && field.path.length > 1) {
          const parent = readPath(block, field.path.slice(0, -1));
          expect(parent, `${block.type} ${field.path.join(".")}`).not.toBeUndefined();
        }
      }
    }
  });
});

describe("path writes", () => {
  it("returns a new object and leaves the original alone", () => {
    // React state identity and the unsaved-changes comparison both depend on it.
    const original = { a: { b: 1 } };
    const next = writePath(original, ["a", "b"], 2);
    expect(next).toEqual({ a: { b: 2 } });
    expect(original).toEqual({ a: { b: 1 } });
    expect(next.a).not.toBe(original.a);
  });

  it("writes through arrays without turning them into objects", () => {
    const original = { items: [{ text: "one" }, { text: "two" }] };
    const next = writePath(original, ["items", 1, "text"], "changed");
    expect(Array.isArray(next.items)).toBe(true);
    expect(next.items[1].text).toBe("changed");
    expect(next.items[0]).toBe(original.items[0]);
  });

  it("DELETES a key written as undefined", () => {
    // The contract distinguishes absent from empty: validators accept a missing
    // optional field and reject an empty string in its place. Clearing a field
    // in the editor has to remove it, or the course stops validating.
    const original = { type: "protocol_step", timing: "07:00", step: 1 };
    const next = writePath(original, ["timing"], undefined);
    expect("timing" in next).toBe(false);
    expect(next.step).toBe(1);
  });

  it("reads a missing path as undefined instead of throwing", () => {
    expect(readPath({ a: 1 }, ["b", "c", "d"])).toBeUndefined();
  });
});

/** Authored (author-editable) leaf paths actually present on a block. */
function authoredPaths(block: LessonBlock): (string | number)[][] {
  const paths: (string | number)[][] = [];
  const record = block as unknown as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (NOT_AUTHORED.has(key)) continue;
    paths.push([key]);
  }

  return paths;
}
