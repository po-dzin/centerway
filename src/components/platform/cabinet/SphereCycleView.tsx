"use client";

/**
 * Карта сфер as the autumn programme's tool, whole (G 23.10: «полностью такую
 * же интерактивную карту сфер, как на оригинальном артефакте»).
 *
 * Five phases as tabs, and each phase decides what the map edits:
 *   «Побачити А» — A and a live example per sphere; spheres can be renamed,
 *     reordered (drag the grip or arrow keys), removed and brought back;
 *   «Обрати Б»   — B and B in words;
 *   «Збудувати міст» — the focus (≤3) and, for each, the bridge from the year
 *     to a step of the week and a step of the day, which «Мій ритм» picks up;
 *   «Прожити»    — seven marks of the week per focus sphere;
 *   «Пересібрати» — A′ and three review answers.
 * The radar is a control in the editing phases: drag a point along its axis,
 * click an axis to put the value there, or focus a point and use the arrow
 * keys. The row's slider does the same.
 *
 * Selection families: the phase tabs and the focus chips are contour plates
 * (`aria-selected` / `aria-pressed`); the radar points and sliders are value
 * controls (`role="slider"`, `input[type=range]`).
 */

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { ProfileLang } from "@/components/platform/profile/types";
import {
  CYCLE_PHASES,
  CYCLE_SPHERES_MIN,
  WEEK_DAYS,
  moveSphere,
  phaseField,
  type BridgeStep,
  type Cycle,
  type CyclePhase,
  type ProfileMapDoc,
} from "@/lib/profile/cycle";
import {
  SPHERE_AXIS_IDS,
  SPHERE_FOCUS_GAP,
  SPHERE_FOCUS_MAX,
  SPHERE_NOTE_MAX,
  type SphereAxisId,
} from "@/lib/profile/sphereMap";

import { getCycleCopy } from "./cycleCopy";
import { sphereName } from "./sphereMapCopy";
import styles from "./SphereCycle.module.css";

const CX = 130;
const CY = 184;
const R = 140;

const COLORS: Record<SphereAxisId, string> = {
  body: "var(--cw-sem-embodied)",
  state: "var(--cw-sem-trust)",
  people: "var(--cw-sem-boundary)",
  work: "var(--cw-sem-warmth-strong)",
  environment: "var(--cw-sem-guide-primary)",
  growth: "var(--cw-sem-dosha-vata)",
  rest: "var(--cw-sem-warmth)",
};

type Field = "now" | "goal" | "after";

export function SphereCycleView({
  doc,
  lang,
  setScore,
  setNote,
  setCycle,
  edit,
  onGoRhythm,
}: {
  doc: ProfileMapDoc;
  lang: ProfileLang;
  setScore: (id: SphereAxisId, mode: "now" | "goal", value: number) => void;
  setNote: (id: SphereAxisId, note: string) => void;
  setCycle: (edit: (cycle: Cycle) => Cycle) => void;
  edit: (edit: (doc: ProfileMapDoc) => ProfileMapDoc) => void;
  onGoRhythm?: () => void;
}) {
  const copy = getCycleCopy(lang);
  const { cycle } = doc;
  const phase = cycle.phase;
  const field = phaseField(phase);
  const order = cycle.order;
  const count = order.length;

  const nameOf = (id: SphereAxisId) => cycle.labels[id] ?? sphereName(id, lang);
  const valueOf = (id: SphereAxisId, which: Field): number | null => {
    const score = doc.spheres[id];
    if (which === "now") return score?.now ?? null;
    if (which === "goal") return score?.goal ?? null;
    return cycle.after[id] ?? score?.now ?? null;
  };
  const gapOf = (id: SphereAxisId) => {
    const base = valueOf(id, phase === "rebuild" ? "after" : "now");
    const goal = valueOf(id, "goal");
    return base === null || goal === null ? null : goal - base;
  };

  const setValue = (id: SphereAxisId, raw: number) => {
    if (!field) return;
    const value = Math.max(0, Math.min(10, Math.round(raw)));
    if (valueOf(id, field) === value && (field !== "after" || cycle.after[id] !== undefined)) return;
    if (field === "after") setCycle((current) => ({ ...current, after: { ...current.after, [id]: value } }));
    else setScore(id, field, value);
  };

  /* ── geometry ── */
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const point = (index: number, value: number) => {
    const a = angle(index);
    const r = (R * value) / 10;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
  };
  const polygon = (which: Field) =>
    order
      .map((id, index) =>
        point(index, valueOf(id, which) ?? 0)
          .map((n) => n.toFixed(1))
          .join(","),
      )
      .join(" ");

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const moved = useRef(false);
  const svgPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    return p.matrixTransform(matrix.inverse());
  };
  const valueOnAxis = (index: number, p: { x: number; y: number }) => {
    const a = angle(index);
    return (((p.x - CX) * Math.cos(a) + (p.y - CY) * Math.sin(a)) / R) * 10;
  };
  const nearestAxis = (p: { x: number; y: number }) => {
    const pa = Math.atan2(p.y - CY, p.x - CX);
    let best = 0;
    let bestDistance = Infinity;
    order.forEach((_, index) => {
      let d = Math.abs(pa - angle(index)) % (2 * Math.PI);
      d = Math.min(d, 2 * Math.PI - d);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    });
    return best;
  };

  const onRadarDown = (event: PointerEvent<SVGSVGElement>) => {
    const handle = (event.target as Element).closest("[data-handle]");
    if (!handle || !field) return;
    dragging.current = Number(handle.getAttribute("data-handle"));
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onRadarMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const p = svgPoint(event);
    if (!p) return;
    moved.current = true;
    const id = order[dragging.current];
    if (id) setValue(id, valueOnAxis(dragging.current, p));
  };
  const onRadarUp = () => {
    dragging.current = null;
  };
  const onRadarClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!field || moved.current) {
      moved.current = false;
      return;
    }
    if ((event.target as Element).closest("[data-handle]")) return;
    const p = svgPoint(event);
    if (!p || Math.hypot(p.x - CX, p.y - CY) > R * 1.12) return;
    const index = nearestAxis(p);
    const id = order[index];
    if (id) setValue(id, valueOnAxis(index, p));
  };
  const onHandleKey = (event: KeyboardEvent<SVGGElement>, id: SphereAxisId) => {
    if (!field) return;
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setValue(id, (valueOf(id, field) ?? 0) + delta);
  };

  /* ── rows: reorder by grip ── */
  const rowRefs = useRef<Map<SphereAxisId, HTMLDivElement>>(new Map());
  const [moving, setMoving] = useState<SphereAxisId | null>(null);
  const reorder = (id: SphereAxisId, delta: -1 | 1) =>
    setCycle((current) => ({ ...current, order: moveSphere(current.order, id, delta) }));
  const onGripMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!moving) return;
    const index = order.indexOf(moving);
    const up = order[index - 1];
    const down = order[index + 1];
    const upBox = up ? rowRefs.current.get(up)?.getBoundingClientRect() : null;
    const downBox = down ? rowRefs.current.get(down)?.getBoundingClientRect() : null;
    if (upBox && event.clientY < upBox.top + upBox.height / 2) reorder(moving, -1);
    else if (downBox && event.clientY > downBox.top + downBox.height / 2) reorder(moving, 1);
  };

  const hidden = SPHERE_AXIS_IDS.filter((id) => !order.includes(id));
  const removeSphere = (id: SphereAxisId) =>
    edit((current) => ({
      ...current,
      focus: current.focus.filter((item) => item !== id),
      cycle: { ...current.cycle, order: current.cycle.order.filter((item) => item !== id) },
    }));
  const addSphere = () => {
    const next = hidden[0];
    if (next) setCycle((current) => ({ ...current, order: [...current.order, next] }));
  };

  const focus = doc.focus.filter((id) => order.includes(id));
  const flip = (id: SphereAxisId) =>
    edit((current) => {
      const has = current.focus.includes(id);
      if (!has && current.focus.length >= SPHERE_FOCUS_MAX) return current;
      return { ...current, focus: has ? current.focus.filter((item) => item !== id) : [...current.focus, id] };
    });
  const setBridge = (id: SphereAxisId, key: keyof BridgeStep, value: string) =>
    setCycle((current) => {
      const step: BridgeStep = { ...(current.bridge[id] ?? {}) };
      if (key === "minutes") {
        const minutes = Number.parseInt(value, 10);
        if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 240) step.minutes = minutes;
        else delete step.minutes;
      } else if (value.trim()) step[key] = value;
      else delete step[key];
      return { ...current, bridge: { ...current.bridge, [id]: step } };
    });
  const setGoalText = (id: SphereAxisId, value: string) =>
    setCycle((current) => {
      const goalText = { ...current.goalText };
      if (value.trim()) goalText[id] = value;
      else delete goalText[id];
      return { ...current, goalText };
    });
  const flipDay = (id: SphereAxisId, day: number) =>
    setCycle((current) => {
      const marks = [...(current.week[id] ?? Array.from({ length: WEEK_DAYS }, () => false))];
      marks[day] = !marks[day];
      return { ...current, week: { ...current.week, [id]: marks } };
    });
  const setReview = (key: keyof Cycle["review"], value: string) =>
    setCycle((current) => ({ ...current, review: { ...current.review, [key]: value } }));
  const setLabel = (id: SphereAxisId, value: string) =>
    setCycle((current) => {
      const labels = { ...current.labels };
      if (value.trim() && value.trim() !== sphereName(id, lang)) labels[id] = value;
      else delete labels[id];
      return { ...current, labels };
    });
  const setPhase = (next: CyclePhase) => setCycle((current) => ({ ...current, phase: next }));

  const average = (which: Field) => {
    const values = order.map((id) => valueOf(id, which)).filter((v): v is number => v !== null);
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : copy.unset;
  };

  const labelLines = useMemo(
    () =>
      order.map((id) => {
        const words = nameOf(id).split(/\s+/);
        const lines = [""];
        for (const word of words) {
          const last = lines[lines.length - 1]!;
          if (last && `${last} ${word}`.length > 10) lines.push(word);
          else lines[lines.length - 1] = last ? `${last} ${word}` : word;
        }
        return lines;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, cycle.labels, lang],
  );

  const P = copy.phases[phase];
  const fieldLabel = field ? copy.fieldLabel[field] : "";

  return (
    <div className={styles.cycle}>
      <div className={styles.tabs} role="tablist" aria-label={copy.phasesLabel}>
        {CYCLE_PHASES.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={phase === key}
            className={styles.phaseOption}
            onClick={() => setPhase(key)}
          >
            {copy.phases[key].name}
            <small>{copy.phases[key].dates}</small>
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.rows}>
          {field ? <p className={styles.anchors}>{copy.anchors}</p> : null}
          {order.map((id) => {
            const name = nameOf(id);
            const gap = gapOf(id);
            const big = gap !== null && gap >= SPHERE_FOCUS_GAP;
            const now = valueOf(id, "now");
            const goal = valueOf(id, "goal");
            const after = valueOf(id, "after");
            const current = field ? valueOf(id, field) : null;
            return (
              <div
                key={id}
                ref={(node) => {
                  if (node) rowRefs.current.set(id, node);
                  else rowRefs.current.delete(id);
                }}
                className={styles.row}
                data-moving={moving === id || undefined}
                style={{ "--c": COLORS[id] } as React.CSSProperties}
              >
                <div className={styles.top}>
                  <button
                    type="button"
                    className={styles.gripControl}
                    aria-label={copy.grip(name)}
                    onPointerDown={(event) => {
                      setMoving(id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      event.preventDefault();
                    }}
                    onPointerMove={onGripMove}
                    onPointerUp={() => setMoving(null)}
                    onPointerCancel={() => setMoving(null)}
                    onKeyDown={(event) => {
                      const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
                      if (!delta) return;
                      event.preventDefault();
                      reorder(id, delta as -1 | 1);
                    }}
                  >
                    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
                      <g fill="currentColor">
                        <circle cx="3" cy="3" r="1.4" />
                        <circle cx="9" cy="3" r="1.4" />
                        <circle cx="3" cy="8" r="1.4" />
                        <circle cx="9" cy="8" r="1.4" />
                        <circle cx="3" cy="13" r="1.4" />
                        <circle cx="9" cy="13" r="1.4" />
                      </g>
                    </svg>
                  </button>
                  <i className={styles.dot} aria-hidden="true" />
                  <input
                    className={styles.name}
                    type="text"
                    value={name}
                    maxLength={40}
                    aria-label={copy.rename}
                    onChange={(event) => setLabel(id, event.target.value)}
                  />
                  {!field ? (
                    <span className={styles.value}>
                      {phase === "rebuild"
                        ? `${now ?? copy.unset} → ${after ?? copy.unset}`
                        : `${now ?? copy.unset} → ${goal ?? copy.unset}`}
                      {gap !== null ? (
                        <span className={big ? styles.gapBig : styles.gap}>
                          {" "}
                          · {gap > 0 ? "+" : ""}
                          {gap}
                        </span>
                      ) : null}
                    </span>
                  ) : phase !== "see" && gap !== null ? (
                    <span className={big ? styles.gapBig : styles.gap}>
                      {phase === "rebuild" ? copy.gapAfter(gap) : copy.gap(gap)}
                    </span>
                  ) : null}
                  {phase === "see" && count > CYCLE_SPHERES_MIN ? (
                    <button
                      type="button"
                      className={styles.hideControl}
                      aria-label={copy.hide(name)}
                      onClick={() => removeSphere(id)}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {field ? (
                  <label className={styles.slider} data-field={field}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={current ?? 0}
                      aria-label={`${name}, ${fieldLabel}`}
                      aria-valuetext={current === null ? copy.unset : String(current)}
                      onChange={(event) => setValue(id, Number(event.target.value))}
                    />
                    <b>{current ?? copy.unset}</b>
                  </label>
                ) : null}
                {phase === "see" ? (
                  <textarea
                    className={styles.text}
                    rows={2}
                    maxLength={SPHERE_NOTE_MAX}
                    value={doc.spheres[id]?.note ?? ""}
                    placeholder={copy.examplePlaceholder}
                    aria-label={copy.exampleLabel(name)}
                    onChange={(event) => setNote(id, event.target.value)}
                  />
                ) : null}
                {phase === "choose" ? (
                  <textarea
                    className={styles.text}
                    rows={2}
                    maxLength={280}
                    value={cycle.goalText[id] ?? ""}
                    placeholder={copy.goalPlaceholder}
                    aria-label={copy.goalLabel(name)}
                    onChange={(event) => setGoalText(id, event.target.value)}
                  />
                ) : null}
              </div>
            );
          })}
          {phase === "see" && hidden.length > 0 ? (
            <button type="button" className={styles.ghostAction} onClick={addSphere}>
              {copy.addSphere}
            </button>
          ) : null}
        </div>

        <div className={styles.radar}>
          <svg
            ref={svgRef}
            viewBox="-104 -30 468 420"
            role="group"
            aria-label={copy.radarLabel}
            data-live={field ? "" : undefined}
            onPointerDown={onRadarDown}
            onPointerMove={onRadarMove}
            onPointerUp={onRadarUp}
            onPointerCancel={onRadarUp}
            onClick={onRadarClick}
          >
            {[2, 4, 6, 8, 10].map((v) => (
              <polygon
                key={v}
                className={styles.ring}
                points={order
                  .map((_, index) =>
                    point(index, v)
                      .map((n) => n.toFixed(1))
                      .join(","),
                  )
                  .join(" ")}
              />
            ))}
            {order.map((id, index) => {
              const [x, y] = point(index, 10);
              return <line key={id} className={styles.spoke} x1={CX} y1={CY} x2={x} y2={y} />;
            })}
            {order.map((id, index) => {
              const [lx, ly] = point(index, 11.3);
              const anchor = Math.abs(lx - CX) < 10 ? "middle" : lx > CX ? "start" : "end";
              const lines = [...labelLines[index]!];
              const value = field ? valueOf(id, field) : null;
              if (field) lines.push(value === null ? copy.unset : String(value));
              const lh = 14;
              const top =
                ly < CY - R * 0.8
                  ? -(lines.length - 1) * lh - 2
                  : ly > CY + R * 0.8
                    ? 12
                    : 4 - ((lines.length - 1) * lh) / 2;
              return (
                <text
                  key={id}
                  className={styles.label}
                  data-on={field ? "" : undefined}
                  x={lx}
                  y={ly + top}
                  textAnchor={anchor}
                >
                  {lines.map((line, k) => (
                    <tspan
                      key={k}
                      x={lx}
                      dy={k ? lh : 0}
                      className={field && k === lines.length - 1 ? styles.labelValue : undefined}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              );
            })}
            {phase !== "see" ? <polygon className={styles.shapeGoal} points={polygon("goal")} /> : null}
            <polygon className={styles.shapeNow} points={polygon("now")} />
            {phase === "rebuild" ? <polygon className={styles.shapeAfter} points={polygon("after")} /> : null}
            {field
              ? order.map((id, index) => {
                  const value = valueOf(id, field) ?? 0;
                  const [x, y] = point(index, value);
                  return (
                    <g
                      key={id}
                      className={styles.handle}
                      data-handle={index}
                      tabIndex={0}
                      role="slider"
                      aria-label={`${nameOf(id)}, ${fieldLabel}`}
                      aria-valuemin={0}
                      aria-valuemax={10}
                      aria-valuenow={value}
                      onKeyDown={(event) => onHandleKey(event, id)}
                    >
                      <circle cx={x} cy={y} r={18} fill="transparent" />
                      <circle className={styles.handleRing} data-field={field} cx={x} cy={y} r={9} />
                      <circle cx={x} cy={y} r={4.5} style={{ fill: COLORS[id] }} />
                    </g>
                  );
                })
              : order.map((id, index) => {
                  const [x, y] = point(index, valueOf(id, "now") ?? 0);
                  return <circle key={id} cx={x} cy={y} r={4} style={{ fill: COLORS[id] }} />;
                })}
          </svg>
          <div className={styles.key}>
            <span data-k="now">
              <i />
              {copy.keyNow}
            </span>
            {phase !== "see" ? (
              <span data-k="goal">
                <i />
                {copy.keyGoal}
              </span>
            ) : null}
            {phase === "rebuild" ? (
              <span data-k="after">
                <i />
                {copy.keyAfter}
              </span>
            ) : null}
          </div>
          <p className={styles.hint}>{field ? copy.hintLive(fieldLabel) : copy.hintStill}</p>
        </div>
      </div>

      <section className={styles.tasks} aria-label={copy.phaseTasks(P.name, P.dates)}>
        <h3 className={styles.tasksTitle}>{copy.phaseTasks(P.name, P.dates)}</h3>
        <ol className={styles.taskList}>
          {P.tasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ol>

        {phase === "bridge" ? (
          <>
            <div className={styles.pick} role="group" aria-label={copy.focusPick}>
              {order.map((id) => {
                const gap = gapOf(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={styles.pickOption}
                    aria-pressed={focus.includes(id)}
                    disabled={!focus.includes(id) && focus.length >= SPHERE_FOCUS_MAX}
                    onClick={() => flip(id)}
                  >
                    {nameOf(id)} <span className={styles.mono}>+{Math.max(0, gap ?? 0)}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.cards}>
              {focus.length ? (
                focus.map((id) => {
                  const step = cycle.bridge[id] ?? {};
                  return (
                    <div key={id} className={styles.card} style={{ "--c": COLORS[id] } as React.CSSProperties}>
                      <h4 className={styles.cardTitle}>
                        {nameOf(id)} · {valueOf(id, "now") ?? copy.unset} → {valueOf(id, "goal") ?? copy.unset}
                      </h4>
                      <label className={styles.field}>
                        {copy.bridgeGoal}
                        <input
                          type="text"
                          maxLength={280}
                          value={cycle.goalText[id] ?? ""}
                          placeholder={copy.goalPlaceholder}
                          onChange={(event) => setGoalText(id, event.target.value)}
                        />
                      </label>
                      <label className={styles.field}>
                        {copy.bridgeWeek}
                        <input
                          type="text"
                          maxLength={280}
                          value={step.week ?? ""}
                          placeholder={copy.bridgeWeekPlaceholder}
                          onChange={(event) => setBridge(id, "week", event.target.value)}
                        />
                      </label>
                      <fieldset className={styles.dayStep}>
                        <legend>{copy.bridgeDay}</legend>
                        <label className={styles.field} data-wide="">
                          {copy.bridgeAfter}
                          <input
                            type="text"
                            maxLength={280}
                            value={step.after ?? ""}
                            placeholder={copy.bridgeAfterPlaceholder}
                            onChange={(event) => setBridge(id, "after", event.target.value)}
                          />
                        </label>
                        <label className={styles.field}>
                          {copy.bridgeStep}
                          <input
                            type="text"
                            maxLength={280}
                            value={step.step ?? ""}
                            placeholder={copy.bridgeStepPlaceholder}
                            onChange={(event) => setBridge(id, "step", event.target.value)}
                          />
                        </label>
                        <label className={styles.field}>
                          {copy.bridgeMinutes}
                          <input
                            type="number"
                            min={1}
                            max={240}
                            step={5}
                            value={step.minutes ?? ""}
                            placeholder="15"
                            onChange={(event) => setBridge(id, "minutes", event.target.value)}
                          />
                        </label>
                      </fieldset>
                    </div>
                  );
                })
              ) : (
                <p className={styles.muted}>{copy.focusEmpty}</p>
              )}
            </div>
            {onGoRhythm ? (
              <button type="button" className={styles.goAction} onClick={onGoRhythm}>
                {copy.toRhythm}
              </button>
            ) : null}
            <p className={styles.out}>
              {copy.toRhythmNote} {copy.phaseOut(P.out)}
            </p>
          </>
        ) : phase === "live" ? (
          <>
            <div className={styles.cards}>
              {focus.length ? (
                focus.map((id) => {
                  const marks = cycle.week[id] ?? Array.from({ length: WEEK_DAYS }, () => false);
                  const step = cycle.bridge[id];
                  const text = step?.step
                    ? `${step.after ? copy.after(step.after) : ""}${step.step}${step.minutes ? ` · ${copy.duration(step.minutes)}` : ""}`
                    : "";
                  return (
                    <div key={id} className={styles.card} style={{ "--c": COLORS[id] } as React.CSSProperties}>
                      <h4 className={styles.cardTitle}>{nameOf(id)}</h4>
                      <span className={styles.muted}>{copy.stepOf(text || copy.stepUnset)}</span>
                      <div className={styles.week}>
                        {copy.weekDays.map((day, j) => (
                          <button
                            key={day}
                            type="button"
                            className={styles.dayOption}
                            aria-pressed={Boolean(marks[j])}
                            aria-label={`${nameOf(id)}, ${day}`}
                            onClick={() => flipDay(id, j)}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                      <span className={styles.mono}>{copy.daysOf(marks.filter(Boolean).length)}</span>
                    </div>
                  );
                })
              ) : (
                <p className={styles.muted}>{copy.focusFirst}</p>
              )}
            </div>
            <p className={styles.out}>{copy.phaseOut(P.out)}</p>
          </>
        ) : phase === "rebuild" ? (
          <>
            <div className={styles.cards}>
              {(["worked", "didnt", "change"] as const).map((key) => (
                <div key={key} className={styles.card} style={{ "--c": "var(--cw-sem-trust)" } as React.CSSProperties}>
                  <label className={styles.field}>
                    {copy.review[key]}
                    <input
                      type="text"
                      maxLength={280}
                      value={cycle.review[key] ?? ""}
                      onChange={(event) => setReview(key, event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className={styles.out}>{copy.phaseOut(P.out)}</p>
          </>
        ) : (
          <p className={styles.out}>{copy.phaseOut(P.out)}</p>
        )}
      </section>

      <div className={styles.foot}>
        <span className={styles.mono}>
          {copy.summary(
            count,
            average("now"),
            phase !== "see" ? average("goal") : null,
            phase === "rebuild" ? average("after") : null,
          )}
        </span>
      </div>
      <p className={styles.muted}>{copy.footer}</p>
    </div>
  );
}
