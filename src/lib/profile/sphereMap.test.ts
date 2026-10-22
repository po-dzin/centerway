import { describe, expect, it } from "vitest";

import {
  SPHERE_AXES,
  SPHERE_HISTORY_MAX,
  nextSphereHistory,
  nowScores,
  radarPoints,
  radarPolygon,
  readStoredSphereMap,
  sphereGap,
  suggestFocus,
  toggleFocus,
  validateSphereMapInput,
  type SphereSnapshot,
} from "./sphereMap";

describe("sphere axes", () => {
  it("are seven, with stable unique ids", () => {
    expect(SPHERE_AXES.map((axis) => axis.id)).toEqual([
      "body",
      "state",
      "people",
      "work",
      "environment",
      "growth",
      "rest",
    ]);
  });
});

describe("validateSphereMapInput", () => {
  it("accepts a full map and trims the note", () => {
    const result = validateSphereMapInput({
      spheres: { body: { now: 4, goal: 8, note: "  гуляю двічі на тиждень " }, rest: { now: 0, goal: 10 } },
      focus: ["body"],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        spheres: { body: { now: 4, goal: 8, note: "гуляю двічі на тиждень" }, rest: { now: 0, goal: 10 } },
        focus: ["body"],
      },
    });
  });

  it("treats a missing score as unset", () => {
    const result = validateSphereMapInput({ spheres: { work: { goal: 7 } } });
    expect(result).toEqual({ ok: true, value: { spheres: { work: { now: null, goal: 7 } }, focus: [] } });
  });

  it.each([
    ["not an object", [], "invalid_body"],
    ["an unknown top-level field", { spheres: {}, owner: "x" }, "unknown_field"],
    ["an unknown sphere", { spheres: { money: { now: 3 } } }, "unknown_sphere"],
    ["a score above 10", { spheres: { body: { now: 11 } } }, "invalid_score"],
    ["a negative score", { spheres: { body: { goal: -1 } } }, "invalid_score"],
    ["a fractional score", { spheres: { body: { now: 4.5 } } }, "invalid_score"],
    ["a score as a string", { spheres: { body: { now: "4" } } }, "invalid_score"],
    ["an extra key on a sphere", { spheres: { body: { now: 4, weight: 1 } } }, "invalid_sphere"],
    ["a note that is too long", { spheres: { body: { now: 4, note: "a".repeat(281) } } }, "note_too_long"],
    ["four focus spheres", { focus: ["body", "state", "people", "work"] }, "focus_too_long"],
    ["a repeated focus sphere", { focus: ["body", "body"] }, "duplicate_focus"],
    ["an unknown focus sphere", { focus: ["money"] }, "unknown_sphere"],
    ["a phase that is not text", { phase: 3 }, "invalid_phase"],
  ])("refuses %s", (_label, body, error) => {
    expect(validateSphereMapInput(body)).toEqual({ ok: false, error });
  });

  it("keeps a short phase label", () => {
    const result = validateSphereMapInput({ spheres: {}, focus: [], phase: " Тиждень 1 " });
    expect(result).toEqual({ ok: true, value: { spheres: {}, focus: [], phase: "Тиждень 1" } });
  });
});

describe("readStoredSphereMap", () => {
  it("drops what it cannot read instead of failing", () => {
    const map = readStoredSphereMap({
      spheres: { body: { now: 5, goal: 99 }, money: { now: 1 }, rest: "x" },
      focus: ["body", "body", "nope", "rest"],
      history: [{ at: "2026-10-22T10:00:00.000Z", now: { body: 5, state: 12 } }, { nope: true }],
      updated_at: "2026-10-22T10:00:00.000Z",
    });
    expect(map).toEqual({
      spheres: { body: { now: 5, goal: null } },
      focus: ["body", "rest"],
      history: [{ at: "2026-10-22T10:00:00.000Z", now: { body: 5 } }],
      updatedAt: "2026-10-22T10:00:00.000Z",
    });
  });

  it("is empty for a person without a row", () => {
    expect(readStoredSphereMap(null)).toEqual({ spheres: {}, focus: [], history: [], updatedAt: null });
  });
});

describe("nextSphereHistory", () => {
  const day1 = new Date("2026-10-22T09:00:00.000Z");
  const day1Later = new Date("2026-10-22T18:00:00.000Z");
  const day2 = new Date("2026-10-23T09:00:00.000Z");

  it("records nothing while no A score is set", () => {
    expect(nextSphereHistory([], {}, day1)).toEqual([]);
  });

  it("starts with the first assessment", () => {
    expect(nextSphereHistory([], { body: 4 }, day1)).toEqual([{ at: day1.toISOString(), now: { body: 4 } }]);
  });

  it("adds nothing when A did not change", () => {
    const history: SphereSnapshot[] = [{ at: day1.toISOString(), now: { body: 4 } }];
    expect(nextSphereHistory(history, { body: 4 }, day2)).toBe(history);
  });

  it("folds saves on the same day into one snapshot", () => {
    const history = nextSphereHistory([], { body: 4 }, day1);
    expect(nextSphereHistory(history, { body: 5 }, day1Later)).toEqual([
      { at: day1Later.toISOString(), now: { body: 5 } },
    ]);
  });

  it("keeps a new day as a new snapshot", () => {
    const history = nextSphereHistory([], { body: 4 }, day1);
    expect(nextSphereHistory(history, { body: 6 }, day2)).toHaveLength(2);
  });

  it("keeps a new phase as a new snapshot even on the same day", () => {
    const history = nextSphereHistory([], { body: 4 }, day1);
    const next = nextSphereHistory(history, { body: 4 }, day1Later, "Тиждень 2");
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ phase: "Тиждень 2" });
  });

  it("caps the history and keeps the first snapshot", () => {
    const history: SphereSnapshot[] = Array.from({ length: SPHERE_HISTORY_MAX }, (_, index) => ({
      at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
      now: { body: index % 10 },
    }));
    const next = nextSphereHistory(history, { body: 10 }, new Date("2027-01-01T00:00:00.000Z"));
    expect(next).toHaveLength(SPHERE_HISTORY_MAX);
    expect(next[0]).toEqual(history[0]);
    expect(next.at(-1)).toMatchObject({ now: { body: 10 } });
  });
});

describe("focus", () => {
  it("suggests spheres with a gap of three or more, widest first", () => {
    expect(
      suggestFocus({
        body: { now: 3, goal: 8 },
        state: { now: 5, goal: 7 },
        people: { now: 2, goal: 9 },
        work: { now: 4, goal: 7 },
        rest: { now: null, goal: 10 },
      }),
    ).toEqual(["people", "body", "work"]);
  });

  it("has no gap while a score is unset", () => {
    expect(sphereGap({ now: null, goal: 6 })).toBeNull();
    expect(sphereGap(undefined)).toBeNull();
    expect(sphereGap({ now: 6, goal: 2 })).toBe(-4);
  });

  it("toggles, and never past three", () => {
    expect(toggleFocus([], "body")).toEqual(["body"]);
    expect(toggleFocus(["body", "work"], "body")).toEqual(["work"]);
    expect(toggleFocus(["body", "work", "rest"], "state")).toEqual(["body", "work", "rest"]);
  });

  it("reads the A scores that are set", () => {
    expect(nowScores({ body: { now: 3, goal: 5 }, state: { now: null, goal: 2 } })).toEqual({ body: 3 });
  });
});

describe("radar geometry", () => {
  it("puts the first axis straight up and goes clockwise", () => {
    const [top, right, bottom, left] = radarPoints([10, 10, 10, 10], { cx: 50, cy: 50, radius: 40 });
    expect(top).toEqual({ x: 50, y: 10 });
    expect(right).toEqual({ x: 90, y: 50 });
    expect(bottom).toEqual({ x: 50, y: 90 });
    expect(left).toEqual({ x: 10, y: 50 });
  });

  it("scales by score and puts an unset score at the centre", () => {
    const [half, unset] = radarPoints([5, null], { cx: 0, cy: 0, radius: 40 });
    expect(half).toEqual({ x: 0, y: -20 });
    expect(unset).toEqual({ x: 0, y: 0 });
  });

  it("clamps an out-of-range value", () => {
    const [point] = radarPoints([15], { cx: 0, cy: 0, radius: 10 });
    expect(point).toEqual({ x: 0, y: -10 });
  });

  it("writes an SVG points attribute", () => {
    expect(
      radarPolygon([
        { x: 1, y: 2 },
        { x: 3.5, y: 4 },
      ]),
    ).toBe("1,2 3.5,4");
  });
});
