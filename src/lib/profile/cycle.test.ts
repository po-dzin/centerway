import { describe, expect, it } from "vitest";

import {
  EMPTY_CYCLE,
  dayOf,
  freshDay,
  itemMinutes,
  moveSphere,
  phaseField,
  readStoredCycle,
  slotForStep,
  splitExtras,
  validateCycle,
  validateRhythm,
} from "./cycle";

describe("validateCycle", () => {
  it("accepts an empty object as the default cycle", () => {
    const result = validateCycle({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.order).toHaveLength(7);
  });

  it("refuses fewer than five spheres", () => {
    expect(validateCycle({ order: ["body", "state", "people", "work"] })).toEqual({
      ok: false,
      error: "too_few_spheres",
    });
  });

  it("refuses an unknown sphere, a duplicate and an unknown field", () => {
    expect(validateCycle({ order: ["body", "state", "people", "work", "money"] }).ok).toBe(false);
    expect(validateCycle({ order: ["body", "body", "state", "people", "work"] }).ok).toBe(false);
    expect(validateCycle({ extra: 1 }).ok).toBe(false);
  });

  it("refuses an A′ out of 0–10 and a week that is not seven marks", () => {
    expect(validateCycle({ after: { body: 11 } }).ok).toBe(false);
    expect(validateCycle({ week: { body: [true, false] } }).ok).toBe(false);
  });

  it("trims words and drops empty ones", () => {
    const result = validateCycle({ labels: { body: "  Тіло і рух  ", state: "   " }, review: { worked: " ранок " } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.labels).toEqual({ body: "Тіло і рух" });
    expect(result.value.review).toEqual({ worked: "ранок" });
  });

  it("falls back to the empty cycle on a broken stored value", () => {
    expect(readStoredCycle("broken")).toEqual(EMPTY_CYCLE);
  });
});

describe("validateRhythm", () => {
  it("accepts the example days", () => {
    expect(validateRhythm({ current: "full", days: { full: freshDay("full") } }).ok).toBe(true);
  });

  it("refuses a day whose slots do not fit its type and an unknown block", () => {
    expect(validateRhythm({ days: { avg: { budgets: [60], slots: [[]] } } }).ok).toBe(false);
    const day = freshDay("avg");
    day.slots[0] = [{ block: "no-such-block" }];
    expect(validateRhythm({ days: { avg: day } }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("names the field each phase edits", () => {
    expect(phaseField("see")).toBe("now");
    expect(phaseField("choose")).toBe("goal");
    expect(phaseField("bridge")).toBeNull();
    expect(phaseField("rebuild")).toBe("after");
  });

  it("moves a sphere one place and stops at the ends", () => {
    const order = ["body", "state", "people"] as const;
    expect(moveSphere([...order], "state", -1)).toEqual(["state", "body", "people"]);
    expect(moveSphere([...order], "body", -1)).toEqual([...order]);
  });

  it("puts a day step into the slot its words point at", () => {
    expect(slotForStep("avg", { after: "вечері", step: "розбір" }, 1)).toBe(2);
    expect(slotForStep("avg", { step: "20 хвилин йоги після сніданок" }, 1)).toBe(0);
    expect(slotForStep("avg", { step: "щось" }, 1)).toBe(1);
  });

  it("starts a day from the example and refreshes a stored day that no longer fits", () => {
    expect(dayOf({ current: "avg", days: {} }, "avg").slots[1]).toEqual([
      { block: "work-block" },
      { block: "work-block" },
    ]);
    expect(dayOf({ current: "avg", days: { avg: { budgets: [1], slots: [[]] } } }, "avg")).toEqual(freshDay("avg"));
  });

  it("counts a focus step's minutes from the bridge, 15 when unset", () => {
    expect(itemMinutes({ focus: "body" }, { ...EMPTY_CYCLE, bridge: { body: { minutes: 25 } } })).toBe(25);
    expect(itemMinutes({ focus: "body" }, EMPTY_CYCLE)).toBe(15);
    expect(itemMinutes({ block: "walk" }, EMPTY_CYCLE)).toBe(30);
  });

  it("splits a PUT body and refuses a broken cycle", () => {
    const split = splitExtras({ spheres: {}, focus: [], cycle: {}, rhythm: {} });
    expect(split.ok).toBe(true);
    if (split.ok) expect(split.rest).toEqual({ spheres: {}, focus: [] });
    expect(splitExtras({ cycle: { phase: "nope" } }).ok).toBe(false);
  });
});
