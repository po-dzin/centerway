/**
 * The cycle around the sphere map, and «Мій ритм» (G 23.10: «полностью такую
 * же интерактивную карту сфер, как в «Осеннем цикле», and finish «Мій ритм»).
 *
 * The programme's participant tool, moved from a prototype that kept it in one
 * browser's localStorage into the account:
 *
 *   - CYCLE: the five phases (see A → choose B → build the bridge → live it →
 *     rebuild), the person's own names, order and set of spheres, the year's B
 *     in words, the bridge from the year down to a step of the day, the week of
 *     marks, the after-cycle A′ and the three review answers.
 *   - RHYTHM: day types (full, average, minimal, day off), each a few slots
 *     with a time budget, filled with blocks from a library or with the focus
 *     steps the bridge produced.
 *
 * The scores themselves stay where they were (`SphereMap.spheres`, A = now,
 * B = goal); this module carries everything around them. Pure: the route
 * validates with it, the client builds with it, the store only stores.
 */

import { SPHERE_AXIS_IDS, SPHERE_FOCUS_MAX, type SphereAxisId, type SphereMap, isSphereAxisId } from "./sphereMap";

/* ── Phases ─────────────────────────────────────────────────────────── */

export const CYCLE_PHASES = ["see", "choose", "bridge", "live", "rebuild"] as const;
export type CyclePhase = (typeof CYCLE_PHASES)[number];

export function isCyclePhase(value: unknown): value is CyclePhase {
  return typeof value === "string" && (CYCLE_PHASES as readonly string[]).includes(value);
}

/** Which score a phase edits: A, B, nothing (bridge, live), or A′. */
export function phaseField(phase: CyclePhase): "now" | "goal" | "after" | null {
  if (phase === "see") return "now";
  if (phase === "choose") return "goal";
  if (phase === "rebuild") return "after";
  return null;
}

/** A map has five to seven spheres: fewer is not a picture of a life, more is not a glance. */
export const CYCLE_SPHERES_MIN = 5;
export const CYCLE_LABEL_MAX = 40;
export const CYCLE_TEXT_MAX = 280;
export const CYCLE_MINUTES_MAX = 240;
export const WEEK_DAYS = 7;

export type BridgeStep = {
  /** The week's step: «3 ранкові практики, відбій до 23:00». */
  week?: string;
  /** The anchor the day's step follows: «ранкової склянки води». */
  after?: string;
  /** The day's step itself: «Йога із запису». */
  step?: string;
  minutes?: number;
};

export type Cycle = {
  phase: CyclePhase;
  /** The visible spheres, in the person's order. Hidden ones are left out. */
  order: SphereAxisId[];
  labels: Partial<Record<SphereAxisId, string>>;
  /** A′ — where the sphere is after the cycle (phase «rebuild»). */
  after: Partial<Record<SphereAxisId, number>>;
  /** B in words: what the sphere will be like in a year. */
  goalText: Partial<Record<SphereAxisId, string>>;
  bridge: Partial<Record<SphereAxisId, BridgeStep>>;
  /** Seven marks per focus sphere for the week of «live it». */
  week: Partial<Record<SphereAxisId, boolean[]>>;
  review: { worked?: string; didnt?: string; change?: string };
};

export const EMPTY_CYCLE: Cycle = {
  phase: "see",
  order: [...SPHERE_AXIS_IDS],
  labels: {},
  after: {},
  goalText: {},
  bridge: {},
  week: {},
  review: {},
};

/* ── Rhythm ─────────────────────────────────────────────────────────── */

export const DAY_TYPES = ["full", "avg", "min", "off"] as const;
export type DayTypeId = (typeof DAY_TYPES)[number];

/** The slots of each day type and their default budgets, minutes. */
export const DAY_TYPE_SLOTS: Record<DayTypeId, { id: string; minutes: number }[]> = {
  full: [
    { id: "morning", minutes: 60 },
    { id: "work", minutes: 540 },
    { id: "evening", minutes: 60 },
    { id: "people", minutes: 60 },
  ],
  avg: [
    { id: "morning", minutes: 120 },
    { id: "work", minutes: 360 },
    { id: "evening", minutes: 120 },
  ],
  min: [
    { id: "morning", minutes: 90 },
    { id: "work", minutes: 210 },
    { id: "free", minutes: 180 },
    { id: "evening", minutes: 90 },
  ],
  off: [],
};

export const BLOCK_LEVERS = ["body", "state", "food", "env", "rhythm", "dir", "people"] as const;
export type BlockLever = (typeof BLOCK_LEVERS)[number];

/** The block library. Ids are stable: a stored day refers to them. */
export const RHYTHM_BLOCKS: { id: string; lever: BlockLever; minutes: number }[] = [
  { id: "yoga-record", lever: "body", minutes: 20 },
  { id: "yoga-live", lever: "body", minutes: 60 },
  { id: "exercise", lever: "body", minutes: 10 },
  { id: "walk", lever: "body", minutes: 30 },
  { id: "breath-5x5", lever: "state", minutes: 10 },
  { id: "meditation", lever: "state", minutes: 20 },
  { id: "meditation-live", lever: "state", minutes: 45 },
  { id: "warm-breakfast", lever: "food", minutes: 20 },
  { id: "main-meal", lever: "food", minutes: 40 },
  { id: "light-dinner", lever: "food", minutes: 30 },
  { id: "food-note", lever: "food", minutes: 5 },
  { id: "light-air", lever: "env", minutes: 5 },
  { id: "screen-free-evening", lever: "env", minutes: 60 },
  { id: "tidy-one-place", lever: "env", minutes: 15 },
  { id: "morning-questions", lever: "rhythm", minutes: 5 },
  { id: "evening-review", lever: "rhythm", minutes: 10 },
  { id: "week-planning", lever: "rhythm", minutes: 30 },
  { id: "work-block", lever: "dir", minutes: 180 },
  { id: "step-to-b", lever: "dir", minutes: 30 },
  { id: "creative", lever: "dir", minutes: 60 },
  { id: "close-people", lever: "people", minutes: 60 },
  { id: "hobby", lever: "people", minutes: 60 },
];

const BLOCK_IDS = new Set(RHYTHM_BLOCKS.map((block) => block.id));

export function blockById(id: string) {
  return RHYTHM_BLOCKS.find((block) => block.id === id) ?? null;
}

/** A block in a slot: one from the library, or the day's step of a focus sphere. */
export type RhythmItem = { block: string } | { focus: SphereAxisId };

export type RhythmDay = { budgets: number[]; slots: RhythmItem[][] };

export type Rhythm = {
  current: DayTypeId;
  days: Partial<Record<DayTypeId, RhythmDay>>;
};

export const EMPTY_RHYTHM: Rhythm = { current: "avg", days: {} };

/** A day type as it starts: the default budgets and empty slots. */
export function freshDay(type: DayTypeId): RhythmDay {
  return { budgets: DAY_TYPE_SLOTS[type].map((slot) => slot.minutes), slots: DAY_TYPE_SLOTS[type].map(() => []) };
}

/** The day as stored, or a fresh one when the stored shape no longer fits the type. */
export function dayOf(rhythm: Rhythm, type: DayTypeId): RhythmDay {
  const stored = rhythm.days[type];
  const count = DAY_TYPE_SLOTS[type].length;
  if (!stored || stored.slots.length !== count || stored.budgets.length !== count) return freshDay(type);
  return stored;
}

/** Minutes of one item: a library block's own, a focus step's from the bridge (15 when unset). */
export function itemMinutes(item: RhythmItem, cycle: Cycle): number {
  if ("block" in item) return blockById(item.block)?.minutes ?? 0;
  return cycle.bridge[item.focus]?.minutes ?? 15;
}

/* ── Validation (writes: strict) ────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string | undefined | false {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length > max) return false;
  return trimmed || undefined;
}

function isScore(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateCycle(raw: unknown): Result<Cycle> {
  if (!isPlainObject(raw)) return { ok: false, error: "invalid_cycle" };
  const allowed = new Set(["phase", "order", "labels", "after", "goalText", "bridge", "week", "review"]);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) return { ok: false, error: "unknown_field" };

  const phase = raw.phase ?? "see";
  if (!isCyclePhase(phase)) return { ok: false, error: "invalid_phase" };

  const rawOrder = raw.order ?? SPHERE_AXIS_IDS;
  if (!Array.isArray(rawOrder)) return { ok: false, error: "invalid_order" };
  const order: SphereAxisId[] = [];
  for (const id of rawOrder) {
    if (!isSphereAxisId(id) || order.includes(id)) return { ok: false, error: "invalid_order" };
    order.push(id);
  }
  if (order.length < CYCLE_SPHERES_MIN) return { ok: false, error: "too_few_spheres" };

  const labels: Cycle["labels"] = {};
  if (raw.labels !== undefined) {
    if (!isPlainObject(raw.labels)) return { ok: false, error: "invalid_labels" };
    for (const [id, value] of Object.entries(raw.labels)) {
      if (!isSphereAxisId(id)) return { ok: false, error: "unknown_sphere" };
      const text = cleanText(value, CYCLE_LABEL_MAX);
      if (text === false) return { ok: false, error: "invalid_label" };
      if (text) labels[id] = text;
    }
  }

  const after: Cycle["after"] = {};
  if (raw.after !== undefined) {
    if (!isPlainObject(raw.after)) return { ok: false, error: "invalid_after" };
    for (const [id, value] of Object.entries(raw.after)) {
      if (!isSphereAxisId(id)) return { ok: false, error: "unknown_sphere" };
      if (value === null) continue;
      if (!isScore(value)) return { ok: false, error: "invalid_score" };
      after[id] = value;
    }
  }

  const goalText: Cycle["goalText"] = {};
  if (raw.goalText !== undefined) {
    if (!isPlainObject(raw.goalText)) return { ok: false, error: "invalid_goal_text" };
    for (const [id, value] of Object.entries(raw.goalText)) {
      if (!isSphereAxisId(id)) return { ok: false, error: "unknown_sphere" };
      const text = cleanText(value, CYCLE_TEXT_MAX);
      if (text === false) return { ok: false, error: "invalid_goal_text" };
      if (text) goalText[id] = text;
    }
  }

  const bridge: Cycle["bridge"] = {};
  if (raw.bridge !== undefined) {
    if (!isPlainObject(raw.bridge)) return { ok: false, error: "invalid_bridge" };
    for (const [id, value] of Object.entries(raw.bridge)) {
      if (!isSphereAxisId(id) || !isPlainObject(value)) return { ok: false, error: "invalid_bridge" };
      const step: BridgeStep = {};
      for (const key of Object.keys(value)) {
        if (!["week", "after", "step", "minutes"].includes(key)) return { ok: false, error: "invalid_bridge" };
      }
      for (const key of ["week", "after", "step"] as const) {
        const text = cleanText(value[key], CYCLE_TEXT_MAX);
        if (text === false) return { ok: false, error: "invalid_bridge" };
        if (text) step[key] = text;
      }
      if (value.minutes !== undefined && value.minutes !== null) {
        if (!Number.isInteger(value.minutes) || (value.minutes as number) < 1 || (value.minutes as number) > CYCLE_MINUTES_MAX)
          return { ok: false, error: "invalid_minutes" };
        step.minutes = value.minutes as number;
      }
      if (Object.keys(step).length) bridge[id] = step;
    }
  }

  const week: Cycle["week"] = {};
  if (raw.week !== undefined) {
    if (!isPlainObject(raw.week)) return { ok: false, error: "invalid_week" };
    for (const [id, value] of Object.entries(raw.week)) {
      if (!isSphereAxisId(id) || !Array.isArray(value) || value.length !== WEEK_DAYS) return { ok: false, error: "invalid_week" };
      if (!value.every((mark) => typeof mark === "boolean")) return { ok: false, error: "invalid_week" };
      week[id] = value as boolean[];
    }
  }

  const review: Cycle["review"] = {};
  if (raw.review !== undefined) {
    if (!isPlainObject(raw.review)) return { ok: false, error: "invalid_review" };
    for (const key of Object.keys(raw.review)) {
      if (!["worked", "didnt", "change"].includes(key)) return { ok: false, error: "invalid_review" };
    }
    for (const key of ["worked", "didnt", "change"] as const) {
      const text = cleanText(raw.review[key], CYCLE_TEXT_MAX);
      if (text === false) return { ok: false, error: "invalid_review" };
      if (text) review[key] = text;
    }
  }

  return { ok: true, value: { phase, order, labels, after, goalText, bridge, week, review } };
}

const DAY_ITEMS_MAX = 40;
const BUDGET_MAX = 24 * 60;

export function validateRhythm(raw: unknown): Result<Rhythm> {
  if (!isPlainObject(raw)) return { ok: false, error: "invalid_rhythm" };
  for (const key of Object.keys(raw)) if (key !== "current" && key !== "days") return { ok: false, error: "unknown_field" };
  const current = raw.current ?? "avg";
  if (typeof current !== "string" || !(DAY_TYPES as readonly string[]).includes(current))
    return { ok: false, error: "invalid_day_type" };
  const days: Rhythm["days"] = {};
  if (raw.days !== undefined) {
    if (!isPlainObject(raw.days)) return { ok: false, error: "invalid_days" };
    for (const [type, value] of Object.entries(raw.days)) {
      if (!(DAY_TYPES as readonly string[]).includes(type) || !isPlainObject(value)) return { ok: false, error: "invalid_days" };
      const count = DAY_TYPE_SLOTS[type as DayTypeId].length;
      const { budgets, slots } = value;
      if (!Array.isArray(budgets) || budgets.length !== count) return { ok: false, error: "invalid_budgets" };
      if (!budgets.every((minutes) => Number.isInteger(minutes) && minutes >= 0 && minutes <= BUDGET_MAX))
        return { ok: false, error: "invalid_budgets" };
      if (!Array.isArray(slots) || slots.length !== count) return { ok: false, error: "invalid_slots" };
      const cleanSlots: RhythmItem[][] = [];
      for (const slot of slots) {
        if (!Array.isArray(slot) || slot.length > DAY_ITEMS_MAX) return { ok: false, error: "invalid_slots" };
        const items: RhythmItem[] = [];
        for (const item of slot) {
          if (isPlainObject(item) && typeof item.block === "string" && BLOCK_IDS.has(item.block) && Object.keys(item).length === 1) {
            items.push({ block: item.block });
          } else if (isPlainObject(item) && isSphereAxisId(item.focus) && Object.keys(item).length === 1) {
            items.push({ focus: item.focus });
          } else return { ok: false, error: "invalid_item" };
        }
        cleanSlots.push(items);
      }
      days[type as DayTypeId] = { budgets: budgets as number[], slots: cleanSlots };
    }
  }
  return { ok: true, value: { current: current as DayTypeId, days } };
}

/* ── Reading (lenient: a bad cell is dropped, the rest stays) ───────── */

export function readStoredCycle(raw: unknown): Cycle {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) return EMPTY_CYCLE;
  const strict = validateCycle(raw);
  if (strict.ok) return strict.value;
  // Field by field: keep what still reads.
  const out: Cycle = { ...EMPTY_CYCLE, order: [...EMPTY_CYCLE.order] };
  if (isCyclePhase(raw.phase)) out.phase = raw.phase;
  for (const key of ["order", "labels", "after", "goalText", "bridge", "week", "review"] as const) {
    const one = validateCycle({ [key]: raw[key] });
    if (one.ok) (out as Record<string, unknown>)[key] = one.value[key];
  }
  return out;
}

export function readStoredRhythm(raw: unknown): Rhythm {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) return EMPTY_RHYTHM;
  const strict = validateRhythm(raw);
  return strict.ok ? strict.value : EMPTY_RHYTHM;
}

/* ── Helpers the views share ────────────────────────────────────────── */

/** The focus spheres that are still visible, in focus order. */
export function visibleFocus(focus: SphereAxisId[], cycle: Cycle): SphereAxisId[] {
  return focus.filter((id) => cycle.order.includes(id)).slice(0, SPHERE_FOCUS_MAX);
}

/** Move a sphere one place up or down in the person's order. */
export function moveSphere(order: SphereAxisId[], id: SphereAxisId, delta: -1 | 1): SphereAxisId[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}

/** The slot a focus step belongs in, read from its words (evening, morning, work), else the open one. */
export function slotForStep(type: DayTypeId, step: BridgeStep | undefined, fallback: number): number {
  const text = `${step?.after ?? ""} ${step?.step ?? ""}`.toLowerCase();
  const slots = DAY_TYPE_SLOTS[type];
  const want = /вечер|вечір|ужин|вечер|сон|спати|ніч/.test(text)
    ? "evening"
    : /ран|сніданок|прокид|вод/.test(text)
      ? "morning"
      : /робот|обід|перерв/.test(text)
        ? "work"
        : null;
  const index = want ? slots.findIndex((slot) => slot.id === want) : -1;
  return index >= 0 ? index : fallback;
}

/* ── The whole document the profile reads and writes ────────────────── */

export type ProfileMapExtras = { cycle: Cycle; rhythm: Rhythm };

/** The map with the cycle and the rhythm around it — what the API returns. */
export type ProfileMapDoc = SphereMap & ProfileMapExtras;

/**
 * Splits a PUT body into the sphere map's own fields and the cycle and
 * rhythm, each validated by its own rules. A body without `cycle` or
 * `rhythm` leaves them as stored.
 */
export function splitExtras(
  body: unknown,
): { ok: true; rest: unknown; cycle?: Cycle; rhythm?: Rhythm } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_body" };
  const { cycle, rhythm, ...rest } = body;
  const out: { ok: true; rest: unknown; cycle?: Cycle; rhythm?: Rhythm } = { ok: true, rest };
  if (cycle !== undefined) {
    const parsed = validateCycle(cycle);
    if (!parsed.ok) return parsed;
    out.cycle = parsed.value;
  }
  if (rhythm !== undefined) {
    const parsed = validateRhythm(rhythm);
    if (!parsed.ok) return parsed;
    out.rhythm = parsed.value;
  }
  return out;
}
