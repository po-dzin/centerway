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

import { Icon } from "@/components/Icon";
import type { CabinetCopy } from "./copy";
import styles from "./ShelfFilter.module.css";

/** `"all"` is a real choice, not an absent one — see the note on the chip row. */
export type ShelfCategory = CourseCategory | "all";

export type ShelfQuery = { text: string; category: ShelfCategory };

export const EMPTY_SHELF_QUERY: ShelfQuery = { text: "", category: "all" };

export function isShelfQueryEmpty(query: ShelfQuery): boolean {
  return query.text.trim() === "" && query.category === "all";
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
  if (query.category !== "all" && !entry.categories.includes(query.category)) return false;
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

  return (
    <div className={styles.filter}>
      {/* A LINE ON A RULE, NOT A PILL. The same rule the list itself is drawn
          with: at rest the underline fades at its ends the way every divider in
          this product does, and under the pointer or in focus it gathers into a
          full line and takes the ink up with it. A rounded ground here would
          have made the loudest object on the page the one that holds nothing. */}
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

      {/* «Усі» IS A CHIP LIKE THE OTHERS. It was tempting to make the cleared
          state simply "no chip pressed", but then the row has no pressed chip
          at rest and the reader cannot tell a control that is off from a
          control that is broken.

          THE ROW STAYS WHILE A FILTER IS ACTIVE, EVEN DOWN TO ONE SUBJECT. An
          author filtering to «Харчування» and then deleting every course but
          one under «Рух» used to lose the row entirely — `offered` fell to one
          entry, the row's own condition hid it, and the stale category kept
          rejecting every course with no «Усі» left to reach. The row's
          resting condition still needs two subjects to be worth offering, but
          an ACTIVE filter is a promise of a way back out, and that promise
          holds regardless of how the underlying shelf changed under it. */}
      {offered.length > 1 || query.category !== "all" ? (
        <div className={styles.subjects} role="group" aria-label={copy.shelfFilterLabel}>
          <button
            className={styles.subject}
            type="button"
            aria-pressed={query.category === "all"}
            onClick={() => onChange({ ...query, category: "all" })}
          >
            {copy.shelfFilterAll}
          </button>
          {offered.map((one) => (
            <button
              key={one}
              className={styles.subject}
              type="button"
              aria-pressed={query.category === one}
              onClick={() => onChange({ ...query, category: query.category === one ? "all" : one })}
            >
              {copy.courseCategories[one]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
