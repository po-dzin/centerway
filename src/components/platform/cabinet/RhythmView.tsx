"use client";

/**
 * «Мій ритм» — the day constructor of the autumn programme (G 23.10).
 *
 * No ready-made regimen: the person picks a day type, says how much time each
 * slot really has, and fills the slots from the block library. On top, «Фокус
 * дня»: the day step of each focus sphere from the map's bridge, placed into
 * the slot its words point at (evening, morning, work) in one press. Each day
 * type starts from the prototype's example and can go back to it.
 *
 * Selection families: day types are contour plates (`aria-pressed`), the slot
 * that receives the next block carries the contour (`data-active`).
 */

import { useState } from "react";

import type { ProfileLang } from "@/components/platform/profile/types";
import {
  BLOCK_LEVERS,
  DAY_TYPES,
  DAY_TYPE_SLOTS,
  RHYTHM_BLOCKS,
  blockById,
  dayOf,
  freshDay,
  itemMinutes,
  slotForStep,
  visibleFocus,
  type BlockLever,
  type ProfileMapDoc,
  type Rhythm,
  type RhythmDay,
  type RhythmItem,
} from "@/lib/profile/cycle";
import type { SphereAxisId } from "@/lib/profile/sphereMap";

import { getCycleCopy } from "./cycleCopy";
import { sphereName } from "./sphereMapCopy";
import styles from "./SphereCycle.module.css";

const LEVER_COLORS: Record<BlockLever | "map", string> = {
  body: "var(--cw-sem-embodied)",
  state: "var(--cw-sem-trust)",
  food: "var(--cw-sem-warmth-strong)",
  env: "var(--cw-sem-guide-primary)",
  rhythm: "var(--cw-sem-dosha-vata)",
  dir: "var(--cw-platform-text)",
  people: "var(--cw-sem-boundary)",
  map: "var(--cw-platform-accent)",
};

export function RhythmView({
  doc,
  lang,
  setRhythm,
  onGoMap,
}: {
  doc: ProfileMapDoc;
  lang: ProfileLang;
  setRhythm: (edit: (rhythm: Rhythm) => Rhythm) => void;
  onGoMap?: () => void;
}) {
  const copy = getCycleCopy(lang);
  const { cycle, rhythm } = doc;
  const type = rhythm.current;
  const slots = DAY_TYPE_SLOTS[type];
  const day = dayOf(rhythm, type);
  const [activeSlot, setActive] = useState(0);
  const active = Math.min(activeSlot, Math.max(0, slots.length - 1));

  const nameOf = (id: SphereAxisId) => cycle.labels[id] ?? sphereName(id, lang);
  const slotName = (index: number) => copy.slots[slots[index]?.id ?? ""] ?? "";
  const itemName = (item: RhythmItem) =>
    "block" in item ? (copy.blocks[item.block] ?? item.block) : (cycle.bridge[item.focus]?.step ?? nameOf(item.focus));
  const itemColor = (item: RhythmItem) =>
    "block" in item ? LEVER_COLORS[blockById(item.block)?.lever ?? "dir"] : LEVER_COLORS.map;

  const editDay = (edit: (current: RhythmDay) => RhythmDay) =>
    setRhythm((current) => ({ ...current, days: { ...current.days, [type]: edit(dayOf(current, type)) } }));
  const pickType = (next: Rhythm["current"]) => {
    setActive(0);
    setRhythm((current) => ({ ...current, current: next }));
  };
  const addItem = (slot: number, item: RhythmItem) =>
    editDay((current) => ({
      ...current,
      slots: current.slots.map((items, i) => (i === slot ? [...items, item] : items)),
    }));
  const removeItem = (slot: number, index: number) =>
    editDay((current) => ({
      ...current,
      slots: current.slots.map((items, i) => (i === slot ? items.filter((_, k) => k !== index) : items)),
    }));
  const setBudget = (slot: number, raw: string) =>
    editDay((current) => ({
      ...current,
      budgets: current.budgets.map((minutes, i) =>
        i === slot ? Math.max(0, Math.min(24 * 60, Number.parseInt(raw, 10) || 0)) : minutes,
      ),
    }));

  /* ── Фокус дня ── */
  const focus = visibleFocus(doc.focus, cycle);
  const inDay = (id: SphereAxisId) =>
    day.slots.some((items) => items.some((item) => "focus" in item && item.focus === id));
  const placed = focus.filter((id) => cycle.bridge[id]?.step && inDay(id)).length;
  const placeFocus = (id: SphereAxisId) => {
    const slot = slotForStep(type, cycle.bridge[id], active);
    addItem(slot, { focus: id });
    setActive(slot);
  };
  const unplaceFocus = (id: SphereAxisId) =>
    editDay((current) => ({
      ...current,
      slots: current.slots.map((items) => items.filter((item) => !("focus" in item && item.focus === id))),
    }));

  const used = day.slots.map((items) => items.reduce((sum, item) => sum + itemMinutes(item, cycle), 0));
  const total = used.reduce((a, b) => a + b, 0);
  const personal = used.reduce((sum, minutes, i) => (slots[i]?.id === "work" ? sum : sum + minutes), 0);
  const off = slots.length === 0;

  return (
    <div className={styles.rhythm}>
      <p className={styles.lead}>{copy.rhythmLead}</p>

      <section className={styles.ladder} aria-label={copy.focusDay}>
        <div className={styles.ladderHead}>
          <h3 className={styles.blocksTitle}>{copy.focusDay}</h3>
          {focus.length ? <span className={styles.mono}>{copy.focusDayCount(placed, focus.length)}</span> : null}
        </div>
        {focus.length ? (
          <div className={styles.cards}>
            {focus.map((id) => {
              const step = cycle.bridge[id];
              const has = Boolean(step?.step) && inDay(id);
              const goal = cycle.goalText[id];
              return (
                <div
                  key={id}
                  className={`${styles.card}${has ? ` ${styles.focusOn}` : ""}`}
                  style={{ "--c": LEVER_COLORS.map } as React.CSSProperties}
                >
                  <h4 className={styles.cardTitle}>
                    {has ? "✓ " : ""}
                    {nameOf(id)}
                  </h4>
                  {step?.step ? (
                    <span className={styles.focusStep}>
                      <span>
                        {step.after ? copy.after(step.after) : ""}
                        <b>{step.step}</b> · {copy.duration(step.minutes ?? 15)}
                      </span>
                    </span>
                  ) : (
                    <span className={styles.muted}>{copy.stepUnsetShort}</span>
                  )}
                  {goal || step?.week ? (
                    <span className={styles.muted}>
                      {[goal ? copy.focusGoal(goal) : "", step?.week ? copy.focusWeek(step.week) : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                  {step?.step && !off ? (
                    has ? (
                      <button type="button" className={styles.ghostAction} onClick={() => unplaceFocus(id)}>
                        {copy.removeFromDay}
                      </button>
                    ) : (
                      <button type="button" className={styles.goAction} onClick={() => placeFocus(id)}>
                        {copy.toSlot(slotName(slotForStep(type, step, active)))}
                      </button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.muted}>
            {copy.focusDayEmpty}{" "}
            {onGoMap ? (
              <button type="button" className={styles.ghostAction} onClick={onGoMap}>
                {copy.toMap}
              </button>
            ) : null}
          </p>
        )}
      </section>

      <div className={styles.tabs} role="group" aria-label={copy.dayTypesLabel}>
        {DAY_TYPES.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.phaseOption}
            aria-pressed={key === type}
            onClick={() => pickType(key)}
          >
            {copy.dayTypes[key].name}
          </button>
        ))}
      </div>
      <p className={styles.muted}>{copy.dayTypes[type].hint}</p>

      {off ? (
        <p className={styles.muted}>{copy.offDay}</p>
      ) : (
        <div className={styles.slots}>
          {slots.map((slot, i) => {
            const budget = day.budgets[i] ?? 0;
            const over = used[i]! > budget;
            const name = slotName(i);
            return (
              <div
                key={slot.id}
                className={styles.slot}
                data-active={i === active || undefined}
                tabIndex={0}
                role="button"
                aria-pressed={i === active}
                aria-label={name}
                onClick={() => setActive(i)}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                    event.preventDefault();
                    setActive(i);
                  }
                }}
              >
                <div className={styles.slotHead}>
                  <b>{name}</b>
                  <label className={styles.budget} onClick={(event) => event.stopPropagation()}>
                    {copy.budgetOf}
                    <input
                      type="number"
                      min={0}
                      step={15}
                      value={budget}
                      onChange={(event) => setBudget(i, event.target.value)}
                    />
                    {copy.minutesShort}
                  </label>
                </div>
                <span className={styles.meter} data-over={over || undefined}>
                  <i style={{ width: `${Math.min(100, budget ? (used[i]! / budget) * 100 : 0)}%` }} />
                </span>
                <span className={styles.mono}>{copy.collected(copy.duration(used[i]!), over)}</span>
                <ul className={styles.items}>
                  {day.slots[i]!.length ? (
                    day.slots[i]!.map((item, k) => {
                      const label = itemName(item);
                      return (
                        <li key={k}>
                          <button
                            type="button"
                            className={styles.blockAction}
                            style={{ "--c": itemColor(item) } as React.CSSProperties}
                            aria-label={copy.removeBlock(label)}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeItem(i, k);
                            }}
                          >
                            <span>{label}</span>
                            <span>{copy.duration(itemMinutes(item, cycle))} ×</span>
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <li className={styles.muted}>{copy.emptySlot}</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <section className={styles.lib} aria-label={copy.blocksTitle}>
        <div className={styles.ladderHead}>
          <h3 className={styles.blocksTitle}>{copy.blocksTitle}</h3>
          <span className={styles.muted}>{off ? copy.offNoBlocks : copy.addsTo(slotName(active))}</span>
        </div>
        {BLOCK_LEVERS.map((lever) => (
          <div key={lever} className={styles.libGroup} style={{ "--c": LEVER_COLORS[lever] } as React.CSSProperties}>
            <span>{copy.levers[lever]}</span>
            {RHYTHM_BLOCKS.filter((block) => block.lever === lever).map((block) => (
              <button
                key={block.id}
                type="button"
                className={styles.libOption}
                disabled={off}
                onClick={() => addItem(active, { block: block.id })}
              >
                {copy.blocks[block.id]}
                <small>{copy.duration(block.minutes)}</small>
              </button>
            ))}
          </div>
        ))}
      </section>

      <div className={styles.foot}>
        <span className={styles.mono}>{off ? "" : copy.total(copy.duration(total), copy.duration(personal))}</span>
        {off ? null : (
          <button type="button" className={styles.ghostAction} onClick={() => editDay(() => freshDay(type))}>
            {copy.resetExample}
          </button>
        )}
      </div>
      <p className={styles.rule}>{copy.rule}</p>
    </div>
  );
}
