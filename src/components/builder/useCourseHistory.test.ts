import { describe, expect, it } from "vitest";

import type { Course } from "@/lms-core";

import { EMPTY_HISTORY, pushEdit, redoStep, undoStep, type History } from "./useCourseHistory";

/**
 * The stack only ever compares courses by identity, so the tests do the same:
 * a named object per state is enough, and building real courses would test
 * `lms-core` rather than the rope.
 */
const course = (title: string) => ({ title }) as unknown as Course;

const start = (first: Course): History => ({ past: [], present: first, future: [], saved: first });

describe("builder undo stack", () => {
  it("ignores an edit before the course has loaded", () => {
    expect(pushEdit(EMPTY_HISTORY, course("a"), false)).toBe(EMPTY_HISTORY);
  });

  it("records the replaced state and walks back to it", () => {
    const a = course("a");
    const b = course("b");

    const edited = pushEdit(start(a), b, false);
    expect(edited.present).toBe(b);
    expect(edited.past).toEqual([a]);

    const back = undoStep(edited);
    expect(back.present).toBe(a);
    expect(back.past).toEqual([]);
    expect(back.future).toEqual([b]);

    expect(redoStep(back).present).toBe(b);
  });

  it("merges a coalesced edit into the entry already on the stack", () => {
    const a = course("a");
    const b = course("ab");
    const c = course("abc");

    // A typing burst: three states, one step back — and that step lands on the
    // text as it stood before the burst, not on the middle of the word.
    const typed = pushEdit(pushEdit(pushEdit(start(a), b, false), c, true), course("abcd"), true);
    expect(typed.past).toEqual([a]);
    expect(undoStep(typed).present).toBe(a);
  });

  it("keeps a structural edit as its own step even when it follows another", () => {
    const a = course("a");
    const b = course("b");
    const c = course("c");

    const moved = pushEdit(pushEdit(start(a), b, false), c, false);
    expect(moved.past).toEqual([a, b]);
    expect(undoStep(moved).present).toBe(b);
  });

  it("drops the redo branch once a new edit lands", () => {
    const a = course("a");
    const b = course("b");

    const undone = undoStep(pushEdit(start(a), b, false));
    expect(undone.future).toEqual([b]);

    const diverged = pushEdit(undone, course("c"), false);
    expect(diverged.future).toEqual([]);
  });

  it("does nothing at either end of the rope", () => {
    const only = start(course("a"));
    expect(undoStep(only)).toBe(only);
    expect(redoStep(only)).toBe(only);
  });

  it("treats an edit that changed nothing as no edit at all", () => {
    const a = course("a");
    const unchanged = start(a);
    expect(pushEdit(unchanged, a, false)).toBe(unchanged);
  });

  it("carries `saved` through so an undo back to it reads as clean", () => {
    const a = course("a");
    const history = undoStep(pushEdit(start(a), course("b"), false));
    expect(history.present).toBe(history.saved);
  });

  it("bounds the stack rather than growing without end", () => {
    let history = start(course("0"));
    for (let step = 1; step <= 140; step += 1) history = pushEdit(history, course(String(step)), false);
    expect(history.past).toHaveLength(100);
    // The oldest states fell off the far end, not the near one.
    expect(history.past.at(-1)).toEqual({ title: "139" });
  });
});
