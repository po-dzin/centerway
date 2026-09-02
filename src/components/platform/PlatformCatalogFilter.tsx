"use client";

/**
 * FINDING ONE MATERIAL AMONG MANY, on the public catalogue.
 *
 * The learner's shelf answers this with a typed line and a set of subjects
 * (`ShelfFilter`). A buyer standing in front of the whole catalogue asks two
 * more questions before either of those: «що це за формат» — a course, a
 * mini-course, a checklist — and «скільки це коштує». So this is that control
 * with two axes added, composed from the same recipe rather than drawn again;
 * the predicate behind all five lives in `lib/platform/catalogQuery.ts`.
 *
 * THE CONTROL IS BUILT FROM THE CATALOGUE, NOT FROM THE MODEL. Every group is
 * offered only when this particular set can be narrowed by it: one kind means
 * no kind group, nothing priced means no interval, nothing free means no free
 * switch. The shelf's rule, stated once and applied here: a chip that can only
 * ever empty the list is a control with nothing behind it.
 *
 * WHY A POPOVER AND NOT A ROW OF CHIPS. The aggregate-catalogue contract asks
 * for "компактные фильтры" that narrow one continuous catalogue. Five axes laid
 * out as chips would take a screen above the first card and turn the catalogue
 * into a form; one bounded disclosure keeps the offers as the page's centre of
 * gravity and says «combine these» honestly, which mutually exclusive tabs
 * cannot.
 *
 * selection_family: `contour` for the search field and the disclosure (one
 * whole quiet edge, gold on hover/focus/open, no ring around the child glyph);
 * `hybrid` for every option row (system checkbox as the semantic signal, the
 * canonical account-menu ink bounded to the label's own width).
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { COURSE_CATEGORY_LABELS, COURSE_KIND_BADGES } from "@/lib/platform/catalogVocabulary";
import {
  countCatalogNarrowing,
  type CatalogFacets,
  type CatalogQuery,
} from "@/lib/platform/catalogQuery";
import type { CourseCategory, CourseKind } from "@/lms-core";
import styles from "./PlatformCatalogFilter.module.css";

export const catalogFilterCopy = {
  searchLabel: "Пошук по каталогу",
  searchPlaceholder: "Знайти матеріал",
  action: "Фільтри",
  title: "Звузити каталог",
  clear: "Скинути",
  kinds: "Формат",
  categories: "Розділ",
  price: "Ціна",
  priceFrom: "від",
  priceTo: "до",
  free: "Тільки безкоштовні",
} as const;

/** Both ends are typed independently, so an empty field is an open end. */
function toAmount(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function PlatformCatalogFilter({
  query,
  onChange,
  facets,
  currency,
}: {
  query: CatalogQuery;
  onChange: (next: CatalogQuery) => void;
  facets: CatalogFacets;
  /** Printed beside the interval so a number is never a bare figure. */
  currency?: string | null;
}) {
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

  const toggleKind = (kind: CourseKind) =>
    onChange({
      ...query,
      kinds: query.kinds.includes(kind)
        ? query.kinds.filter((one) => one !== kind)
        : [...query.kinds, kind],
    });

  const toggleCategory = (category: CourseCategory) =>
    onChange({
      ...query,
      categories: query.categories.includes(category)
        ? query.categories.filter((one) => one !== category)
        : [...query.categories, category],
    });

  const offersKinds = facets.kinds.length > 1 || query.kinds.length > 0;
  const offersCategories = facets.categories.length > 1 || query.categories.length > 0;
  // An interval needs two different figures to sit between. One priced offer,
  // or several at the same price, gives a control that cannot narrow anything.
  const offersPrice =
    (facets.priceFloor !== null && facets.priceCeiling !== null && facets.priceCeiling > facets.priceFloor) ||
    query.price.min !== null ||
    query.price.max !== null;
  const offersFree = facets.freeCount > 0 || query.freeOnly;
  const narrowing = countCatalogNarrowing(query);

  return (
    <div className={styles.filter}>
      {/* Lens and input share one boundary: focus must never appear to select
          the text while hover selects the whole field. */}
      <label className={styles.find}>
        <Icon name="lens" size={18} />
        <input
          className={styles.findInput}
          type="search"
          autoComplete="off"
          value={query.text}
          placeholder={catalogFilterCopy.searchPlaceholder}
          aria-label={catalogFilterCopy.searchLabel}
          onChange={(event) => onChange({ ...query, text: event.target.value })}
        />
      </label>

      {offersKinds || offersCategories || offersPrice || offersFree ? (
        <div className={styles.filterMenu} ref={root}>
          <button
            className={styles.filterToggle}
            type="button"
            aria-label={narrowing > 0 ? `${catalogFilterCopy.action}: ${narrowing}` : catalogFilterCopy.action}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((current) => !current)}
          >
            <Icon name="list" size={18} aria-hidden="true" />
            <span>{catalogFilterCopy.action}</span>
            <span className={styles.filterCount} data-empty={narrowing === 0 || undefined} aria-hidden="true">
              {narrowing || "0"}
            </span>
          </button>

          {open ? (
            <div className={styles.filterPopover} role="group" aria-label={catalogFilterCopy.title}>
              <div className={styles.filterPopoverHead}>
                <span>{catalogFilterCopy.title}</span>
                {narrowing > 0 ? (
                  <button
                    className={styles.filterClear}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...query,
                        kinds: [],
                        categories: [],
                        price: { min: null, max: null },
                        freeOnly: false,
                      })
                    }
                  >
                    {catalogFilterCopy.clear}
                  </button>
                ) : null}
              </div>

              {offersKinds ? (
                <>
                  <p className={styles.groupLabel}>{catalogFilterCopy.kinds}</p>
                  <div className={styles.filterOptions}>
                    {facets.kinds.map((kind) => (
                      <label key={kind} className={styles.filterOption}>
                        <input
                          type="checkbox"
                          checked={query.kinds.includes(kind)}
                          onChange={() => toggleKind(kind)}
                        />
                        <span className={styles.filterCheckbox} aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                        <InteractionInkLabel variant="menu" active={query.kinds.includes(kind)}>
                          {COURSE_KIND_BADGES[kind]}
                        </InteractionInkLabel>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {offersCategories ? (
                <>
                  <p className={styles.groupLabel}>{catalogFilterCopy.categories}</p>
                  <div className={styles.filterOptions}>
                    {facets.categories.map((category) => (
                      <label key={category} className={styles.filterOption}>
                        <input
                          type="checkbox"
                          checked={query.categories.includes(category)}
                          onChange={() => toggleCategory(category)}
                        />
                        <span className={styles.filterCheckbox} aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                        <InteractionInkLabel variant="menu" active={query.categories.includes(category)}>
                          {COURSE_CATEGORY_LABELS[category]}
                        </InteractionInkLabel>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {offersPrice ? (
                <>
                  <p className={styles.groupLabel}>
                    {currency ? `${catalogFilterCopy.price}, ${currency}` : catalogFilterCopy.price}
                  </p>
                  <div className={styles.band}>
                    <span className={styles.bandField}>
                      <input
                        className={styles.bandInput}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={query.price.min ?? ""}
                        placeholder={facets.priceFloor !== null ? String(facets.priceFloor) : undefined}
                        aria-label={`${catalogFilterCopy.price} ${catalogFilterCopy.priceFrom}`}
                        onChange={(event) =>
                          onChange({ ...query, price: { ...query.price, min: toAmount(event.target.value) } })
                        }
                      />
                    </span>
                    <span className={styles.bandDash} aria-hidden="true">
                      –
                    </span>
                    <span className={styles.bandField}>
                      <input
                        className={styles.bandInput}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={query.price.max ?? ""}
                        placeholder={facets.priceCeiling !== null ? String(facets.priceCeiling) : undefined}
                        aria-label={`${catalogFilterCopy.price} ${catalogFilterCopy.priceTo}`}
                        onChange={(event) =>
                          onChange({ ...query, price: { ...query.price, max: toAmount(event.target.value) } })
                        }
                      />
                    </span>
                  </div>
                </>
              ) : null}

              {offersFree ? (
                <div className={styles.filterOptions}>
                  {/* Its own axis rather than «до 0»: free is a commercial STATE,
                      and an interval of zero would also have to decide what to do
                      with the unpriced. See catalogQuery.ts. */}
                  <label className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={query.freeOnly}
                      onChange={() => onChange({ ...query, freeOnly: !query.freeOnly })}
                    />
                    <span className={styles.filterCheckbox} aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                    <InteractionInkLabel variant="menu" active={query.freeOnly}>
                      {catalogFilterCopy.free}
                    </InteractionInkLabel>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { styles as catalogFilterStyles };
