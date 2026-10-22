/**
 * Карта сфер — the pure half: the axes, the shape of a map, the validation the
 * API applies to it, and the geometry the radar draws.
 *
 * No I/O here, so the client and the route read one definition. The store
 * (`sphereMapStore.ts`) is the only thing that touches the database.
 *
 * KEYED BY AXIS, NOT BY NAME. The names below are the programme's working
 * names and are expected to change; a score is stored under `id`, so renaming
 * a sphere is a copy edit and costs nobody their map. Never reuse an id for a
 * different sphere — that would silently move everybody's scores onto it.
 */

export const SPHERE_AXES = [
  { id: "body", name: "Тіло і здоров'я", nameEn: "Body and health" },
  { id: "state", name: "Стан і психіка", nameEn: "State of mind" },
  { id: "people", name: "Близькі і зв'язки", nameEn: "People and ties" },
  { id: "work", name: "Справа і дохід", nameEn: "Work and income" },
  { id: "environment", name: "Середовище і побут", nameEn: "Home and surroundings" },
  { id: "growth", name: "Зростання і сенс", nameEn: "Growth and meaning" },
  { id: "rest", name: "Відпочинок і радість", nameEn: "Rest and joy" },
] as const;

export type SphereAxisId = (typeof SPHERE_AXES)[number]["id"];

export const SPHERE_AXIS_IDS: readonly SphereAxisId[] = SPHERE_AXES.map((axis) => axis.id);

export const SPHERE_SCORE_MIN = 0;
export const SPHERE_SCORE_MAX = 10;
/** A gap (B − A) this wide makes a sphere a candidate for the cycle's focus. */
export const SPHERE_FOCUS_GAP = 3;
export const SPHERE_FOCUS_MAX = 3;
/** A «живий приклад» is a line, not an essay. */
export const SPHERE_NOTE_MAX = 280;
export const SPHERE_PHASE_MAX = 40;
/** Snapshots kept. The first («на старті») always survives the cap. */
export const SPHERE_HISTORY_MAX = 100;

export type SphereScore = {
  /** A — where it is now. Null until the person has said. */
  now: number | null;
  /** B — where they want it to be in a year. */
  goal: number | null;
  /** A live example for A, optional. */
  note?: string;
};

export type SphereSnapshot = {
  at: string;
  phase?: string;
  now: Partial<Record<SphereAxisId, number>>;
};

export type SphereMap = {
  spheres: Partial<Record<SphereAxisId, SphereScore>>;
  focus: SphereAxisId[];
  history: SphereSnapshot[];
  updatedAt: string | null;
};

export type SphereMapInput = {
  spheres: Partial<Record<SphereAxisId, SphereScore>>;
  focus: SphereAxisId[];
  phase?: string;
};

export const EMPTY_SPHERE_MAP: SphereMap = { spheres: {}, focus: [], history: [], updatedAt: null };

export function isSphereAxisId(value: unknown): value is SphereAxisId {
  return typeof value === "string" && (SPHERE_AXIS_IDS as readonly string[]).includes(value);
}

function isScore(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= SPHERE_SCORE_MIN && (value as number) <= SPHERE_SCORE_MAX;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SphereMapValidation = { ok: true; value: SphereMapInput } | { ok: false; error: string };

/**
 * The PUT body, checked strictly. Strict on purpose, and unlike the author
 * editor's lenient readers: there a dropped field is visible in the form, here
 * a silently dropped score is a number the person set and will not see again.
 * So anything unknown or out of range refuses the whole save with a code.
 */
export function validateSphereMapInput(body: unknown): SphereMapValidation {
  if (!isPlainObject(body)) return { ok: false, error: "invalid_body" };

  const allowed = new Set(["spheres", "focus", "phase"]);
  for (const key of Object.keys(body)) if (!allowed.has(key)) return { ok: false, error: "unknown_field" };

  const rawSpheres = body.spheres ?? {};
  if (!isPlainObject(rawSpheres)) return { ok: false, error: "invalid_spheres" };

  const spheres: SphereMapInput["spheres"] = {};
  for (const [id, raw] of Object.entries(rawSpheres)) {
    if (!isSphereAxisId(id)) return { ok: false, error: "unknown_sphere" };
    if (!isPlainObject(raw)) return { ok: false, error: "invalid_sphere" };
    for (const key of Object.keys(raw)) {
      if (key !== "now" && key !== "goal" && key !== "note") return { ok: false, error: "invalid_sphere" };
    }
    const now = raw.now ?? null;
    const goal = raw.goal ?? null;
    if (now !== null && !isScore(now)) return { ok: false, error: "invalid_score" };
    if (goal !== null && !isScore(goal)) return { ok: false, error: "invalid_score" };
    let note: string | undefined;
    if (raw.note !== undefined && raw.note !== null) {
      if (typeof raw.note !== "string") return { ok: false, error: "invalid_note" };
      const trimmed = raw.note.trim();
      if (trimmed.length > SPHERE_NOTE_MAX) return { ok: false, error: "note_too_long" };
      if (trimmed) note = trimmed;
    }
    spheres[id] = { now, goal, ...(note ? { note } : {}) };
  }

  const rawFocus = body.focus ?? [];
  if (!Array.isArray(rawFocus)) return { ok: false, error: "invalid_focus" };
  if (rawFocus.length > SPHERE_FOCUS_MAX) return { ok: false, error: "focus_too_long" };
  const focus: SphereAxisId[] = [];
  for (const id of rawFocus) {
    if (!isSphereAxisId(id)) return { ok: false, error: "unknown_sphere" };
    if (focus.includes(id)) return { ok: false, error: "duplicate_focus" };
    focus.push(id);
  }

  let phase: string | undefined;
  if (body.phase !== undefined && body.phase !== null) {
    if (typeof body.phase !== "string") return { ok: false, error: "invalid_phase" };
    const trimmed = body.phase.trim();
    if (trimmed.length > SPHERE_PHASE_MAX) return { ok: false, error: "invalid_phase" };
    if (trimmed) phase = trimmed;
  }

  return { ok: true, value: { spheres, focus, ...(phase ? { phase } : {}) } };
}

/**
 * A row as the database holds it, read defensively: jsonb written by an older
 * build or by hand must not crash the profile. Anything unreadable is dropped
 * here rather than refused — this is the read path, and a person's map with one
 * bad cell is still their map.
 */
export function readStoredSphereMap(row: {
  spheres?: unknown;
  focus?: unknown;
  history?: unknown;
  updated_at?: unknown;
} | null): SphereMap {
  if (!row) return EMPTY_SPHERE_MAP;
  const spheres: SphereMap["spheres"] = {};
  if (isPlainObject(row.spheres)) {
    for (const [id, raw] of Object.entries(row.spheres)) {
      if (!isSphereAxisId(id) || !isPlainObject(raw)) continue;
      spheres[id] = {
        now: isScore(raw.now) ? raw.now : null,
        goal: isScore(raw.goal) ? raw.goal : null,
        ...(typeof raw.note === "string" && raw.note ? { note: raw.note.slice(0, SPHERE_NOTE_MAX) } : {}),
      };
    }
  }
  const focus = Array.isArray(row.focus)
    ? row.focus.filter(isSphereAxisId).filter((id, index, list) => list.indexOf(id) === index).slice(0, SPHERE_FOCUS_MAX)
    : [];
  const history: SphereSnapshot[] = Array.isArray(row.history)
    ? row.history.flatMap((raw): SphereSnapshot[] => {
        if (!isPlainObject(raw) || typeof raw.at !== "string" || !isPlainObject(raw.now)) return [];
        const now: SphereSnapshot["now"] = {};
        for (const [id, value] of Object.entries(raw.now)) if (isSphereAxisId(id) && isScore(value)) now[id] = value;
        return [{ at: raw.at, ...(typeof raw.phase === "string" && raw.phase ? { phase: raw.phase } : {}), now }];
      })
    : [];
  return { spheres, focus, history, updatedAt: typeof row.updated_at === "string" ? row.updated_at : null };
}

/** The A scores of a map, only those set — what a snapshot records. */
export function nowScores(spheres: SphereMap["spheres"]): SphereSnapshot["now"] {
  const out: SphereSnapshot["now"] = {};
  for (const id of SPHERE_AXIS_IDS) {
    const value = spheres[id]?.now;
    if (typeof value === "number") out[id] = value;
  }
  return out;
}

function sameScores(a: SphereSnapshot["now"], b: SphereSnapshot["now"]): boolean {
  return SPHERE_AXIS_IDS.every((id) => a[id] === b[id]);
}

/**
 * The history after a save. A save that did not change A adds nothing. A save
 * on the same calendar day (UTC) and in the same phase as the last snapshot
 * REPLACES it: the map is saved on every tap, and a person settling seven
 * numbers in one sitting has made one assessment, not forty. The first entry
 * («на старті») survives the cap.
 */
export function nextSphereHistory(
  history: SphereSnapshot[],
  now: SphereSnapshot["now"],
  at: Date,
  phase?: string,
): SphereSnapshot[] {
  if (Object.keys(now).length === 0) return history;
  const last = history.at(-1);
  if (last && sameScores(last.now, now) && (last.phase ?? undefined) === phase) return history;

  const entry: SphereSnapshot = { at: at.toISOString(), ...(phase ? { phase } : {}), now };
  const sameDay = last && last.at.slice(0, 10) === entry.at.slice(0, 10) && (last.phase ?? undefined) === phase;
  const next = sameDay ? [...history.slice(0, -1), entry] : [...history, entry];
  if (next.length <= SPHERE_HISTORY_MAX) return next;
  return [next[0]!, ...next.slice(next.length - (SPHERE_HISTORY_MAX - 1))];
}

/** B − A, or null while either is unset. */
export function sphereGap(score: SphereScore | undefined): number | null {
  if (!score || score.now === null || score.goal === null) return null;
  return score.goal - score.now;
}

/**
 * The spheres the map suggests for the focus: a gap of SPHERE_FOCUS_GAP or
 * more, widest first, ties in axis order. A suggestion, never a choice — the
 * person picks the focus.
 */
export function suggestFocus(spheres: SphereMap["spheres"]): SphereAxisId[] {
  return SPHERE_AXIS_IDS.map((id, index) => ({ id, index, gap: sphereGap(spheres[id]) }))
    .filter((row): row is { id: SphereAxisId; index: number; gap: number } => (row.gap ?? 0) >= SPHERE_FOCUS_GAP)
    .sort((a, b) => b.gap - a.gap || a.index - b.index)
    .map((row) => row.id);
}

/** Adds or removes a sphere from the focus, never past the limit. */
export function toggleFocus(focus: SphereAxisId[], id: SphereAxisId): SphereAxisId[] {
  if (focus.includes(id)) return focus.filter((item) => item !== id);
  if (focus.length >= SPHERE_FOCUS_MAX) return focus;
  return [...focus, id];
}

export type RadarPoint = { x: number; y: number };

/**
 * One point per axis, the first straight up and the rest clockwise. A missing
 * score sits at the centre: an unrated sphere is drawn as nothing yet, not as
 * a guess. Rounded to two places so the SVG stays short and stable.
 */
export function radarPoints(
  values: ReadonlyArray<number | null | undefined>,
  { cx, cy, radius, max = SPHERE_SCORE_MAX }: { cx: number; cy: number; radius: number; max?: number },
): RadarPoint[] {
  const count = values.length;
  return values.map((value, index) => {
    const share = Math.max(0, Math.min(max, value ?? 0)) / max;
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: Math.round((cx + Math.cos(angle) * radius * share) * 100) / 100,
      y: Math.round((cy + Math.sin(angle) * radius * share) * 100) / 100,
    };
  });
}

/** The `points` attribute of an SVG polygon. */
export function radarPolygon(points: RadarPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
