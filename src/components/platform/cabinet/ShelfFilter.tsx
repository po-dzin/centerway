"use client";

/**
 * FINDING ONE COURSE AMONG MANY — one control for both sides of the shelf.
 *
 * The learner's library and the author's workshop are the same shelf seen from
 * two sides, and they are searched the same way: a line to type a name into and
 * a row of subjects to narrow by. Two implementations would have been two
 * behaviours (does the query match the subject too? is «Усі» a button or a
 * cleared state?) and two sets of words for the same three categories, which is
 * the thing `CabinetCopy.courseCategories` exists to prevent.
 *
 * THE QUERY NARROWS; IT DOES NOT REBUILD. `matchesQuery` is a predicate, not a
 * filter — the room hands it to its niches to DIM rather than to re-pack. The
 * prototype's own rule: "запит гасить і рядки, і виїмки, а самої розкладки не
 * чіпає: стіна не перебудовується під запит, вона пригасає." A wall that
 * repacks itself under every keystroke is answering a different question from
 * the one that was asked.
 */

import { COURSE_CATEGORIES, type CourseCategory } from "@/lms-core";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import type { CabinetCopy } from "./copy";
import styles from "./ShelfFilter.module.css";

/**
 * A shelf camera can stand before a concrete section or before the unfiltered
 * overview. This is intentionally broader than the query below: `all` is a
 * navigation destination, never a selected checkbox.
 */
export type ShelfCategory = CourseCategory | "all";

/** Several subjects can describe the same material; an empty set means no
    category narrowing. */
export type ShelfQuery = { text: string; categories: readonly CourseCategory[] };

export const EMPTY_SHELF_QUERY: ShelfQuery = { text: "", categories: [] };

export function isShelfQueryEmpty(query: ShelfQuery): boolean {
  return query.text.trim() === "" && query.categories.length === 0;
}

/**
 * Does this course answer the query?
 *
 * The typed text is matched against everything the reader can SEE of a course
 * in the list — its name and its subjects — because a reader who types
 * «харчування» is pointing at the word under the title just as much as at the
 * title. Matching only the title would have made the subject row the only way
 * to reach by subject, and then the two halves of this control would disagree.
 */
export function matchesShelfQuery(
  entry: { title: string; categories: readonly CourseCategory[] },
  query: ShelfQuery,
  copy: CabinetCopy,
): boolean {
  if (query.categories.length > 0 && !query.categories.some((category) => entry.categories.includes(category))) {
    return false;
  }
  const text = query.text.trim().toLowerCase();
  if (!text) return true;
  const hay = [entry.title, ...entry.categories.map((c) => copy.courseCategories[c])]
    .join(" ")
    .toLowerCase();
  return hay.includes(text);
}

export function ShelfFilter({
  query,
  onChange,
  copy,
  /** Only the subjects this shelf actually holds. A chip that can only ever
      empty the list is a control with nothing behind it. */
  categories,
}: {
  query: ShelfQuery;
  onChange: (next: ShelfQuery) => void;
  copy: CabinetCopy;
  categories: readonly CourseCategory[];
}) {
  const offered = COURSE_CATEGORIES.filter((one) => categories.includes(one));
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleCategory = (category: CourseCategory) => {
    const selected = query.categories.includes(category);
    onChange({
      ...query,
      categories: selected ? query.categories.filter((item) => item !== category) : [...query.categories, category],
    });
  };

  return (
    <div className={styles.filter}>
      {/* Search is one bounded control: its lens and input share the same
          boundary, so focus never appears to select only the text while hover
          selects the whole field. */}
      <label className={styles.find}>
        <Icon name="lens" size={18} />
        <input
          className={styles.findInput}
          type="search"
          autoComplete="off"
          value={query.text}
          placeholder={copy.shelfSearchPlaceholder}
          aria-label={copy.shelfSearchLabel}
          onChange={(event) => onChange({ ...query, text: event.target.value })}
        />
      </label>

      {/* The shelf can now hold several types of material. One popover with
          checkboxes says «combine subjects» honestly; a row of mutually
          exclusive tabs did not. */}
      {offered.length > 1 || query.categories.length > 0 ? (
        <div className={styles.filterMenu} ref={root}>
          <button
            className={styles.filterToggle}
            type="button"
            aria-label={
              query.categories.length > 0
                ? `${copy.shelfFilterAction}: ${query.categories.length}`
                : copy.shelfFilterAction
            }
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((current) => !current)}
          >
            <Icon name="list" size={18} aria-hidden="true" />
            <span>{copy.shelfFilterAction}</span>
            <span
              className={styles.filterCount}
              data-empty={query.categories.length === 0 || undefined}
              aria-hidden="true"
            >
              {query.categories.length || "0"}
            </span>
          </button>
          {open ? (
            <div className={styles.filterPopover} role="group" aria-label={copy.shelfFilterLabel}>
              <div className={styles.filterPopoverHead}>
                <span>{copy.shelfFilterLabel}</span>
                {query.categories.length > 0 ? (
                  <button className={styles.filterClear} type="button" onClick={() => onChange({ ...query, categories: [] })}>
                    {copy.shelfFilterAll}
                  </button>
                ) : null}
              </div>
              <div className={styles.filterOptions}>
                {offered.map((one) => (
                  <label key={one} className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={query.categories.includes(one)}
                      onChange={() => toggleCategory(one)}
                    />
                    <span className={styles.filterCheckbox} aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                    <InteractionInkLabel variant="menu" active={query.categories.includes(one)}>
                      {copy.courseCategories[one]}
                    </InteractionInkLabel>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
