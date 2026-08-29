"use client";

/**
 * The row's overflow menu, and the row's context menu — one list, two ways in.
 *
 * WHY IT EXISTS. A structure row used to carry six things on one line — day,
 * title, block count, up, down, delete — and at 360px the three controls took
 * 147 of the row's 347 pixels, leaving 54 for the title. Ukrainian words are
 * long; the title came out one word per line and the page grew a horizontal
 * scroll. One control instead of three gives the title back ~270px.
 *
 * WHY IT IS ALSO A CONTEXT MENU. The overflow button is the reachable path —
 * touch, keyboard, screen reader. Right-click is the fast path, and on desktop
 * it is where a hand already is when it wants to move a row. Both open the SAME
 * list, so there is no second set of actions to keep in sync. The cost, stated:
 * right-clicking a lesson row no longer offers the browser's "open in new tab".
 *
 * PLACEMENT IS MEASURED, NOT DECLARED, and it is portalled to `document.body`.
 * Absolutely positioned inside the row, the list was laid out below the trigger
 * and then clipped by the viewport — a menu opened on the last card in the grid
 * rendered off the bottom of the screen with its items unreachable. Fixed
 * positioning against a measured rect lets it flip above the trigger when there
 * is no room under it and clamp inside the viewport on both axes.
 *
 * Behaviour is the boring, correct set: Escape closes, a click outside closes,
 * focus returns to the trigger, and the trigger reports `aria-expanded`. The
 * native `popover` attribute would give the first two for free, but positioning
 * it against the trigger still needs CSS anchor positioning, which is not yet
 * safe across the browsers an author might open this in.
 */

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { HandGraphic, Icon } from "@/components/Icon";
import type { CW_ICON_NAMES } from "@/components/iconNames";
import styles from "./Builder.module.css";

type IconName = (typeof CW_ICON_NAMES)[number];

export type MenuItem = {
  label: string;
  onSelect: () => void;
  /** Drawn before the label. Same sprite as everything else in the shell. */
  icon?: IconName;
  /** Tooltip. Falls back to the label, so a truncated item still says itself. */
  hint?: string;
  disabled?: boolean;
  /** Destructive items sit last, behind a divider, in the boundary tone. */
  danger?: boolean;
  /**
   * Opens a new group — a divider above this item.
   *
   * A rule separates items with the SAME subject: «what this paragraph is»
   * from «what to do with this paragraph». For a change of subject a rule is
   * not enough — see `section`.
   */
  startsGroup?: boolean;
  /**
   * WHAT THIS ITEM ACTS ON, named out loud.
   *
   * One list, two subjects: the rich-text node menu says what THIS paragraph
   * is and does, and then what the whole prose block does. A hairline between
   * them was the entire distinction, so «Видалити» and «Видалити блок» read as
   * two adjacent lines differing by one word — and an author who gets that
   * wrong once loses a block instead of a sentence.
   *
   * Items carrying the same section string are gathered into a `role="group"`
   * under a caption that names the subject. The caption IS the separator, so a
   * section-leading item does not also draw `startsGroup`'s rule.
   *
   * Optional, and absent everywhere a menu has one subject — the lesson row,
   * the module head, the course card, a non-prose block's own rail. A heading
   * over a list of four things that obviously belong together is furniture.
   */
  section?: string;
};

type Entry = { item: MenuItem; index: number; opensSection: boolean };

/**
 * Consecutive runs of items that share a `section`.
 *
 * Consecutive, not gathered: the order the caller wrote is the order the author
 * reads, and re-sorting a menu so that two same-named items sit together would
 * move actions out from under the finger that has learned where they are. A
 * caller that interleaves sections gets interleaved captions, which is the
 * honest picture of what it asked for.
 */
function groupItems(items: MenuItem[]): { section?: string; entries: Entry[] }[] {
  const groups: { section?: string; entries: Entry[] }[] = [];
  items.forEach((item, index) => {
    const current = groups[groups.length - 1];
    const opens = !current || current.section !== item.section;
    if (opens) groups.push({ section: item.section, entries: [] });
    groups[groups.length - 1].entries.push({
      item,
      index,
      opensSection: opens && item.section !== undefined,
    });
  });
  return groups;
}

/** Where the list was asked to appear, in viewport coordinates. */
type Origin = { x: number; y: number; below: number; above: number; align: "start" | "end" };

const GAP = 6;
const EDGE = 8;
/** Matches `.menuList { min-width }`; the clamp needs a number before layout. */
const MIN_WIDTH = 192;

export function BuilderMenu({
  label,
  items,
  contextArea = true,
}: {
  label: string;
  items: MenuItem[];
  /**
   * Whether right-clicking the surrounding row opens this menu.
   *
   * The row is this component's PARENT at every call site — the lesson row, the
   * module head, the block head, the rich-text node head, the course card.
   * Reading it from the DOM rather than taking a ref keeps the five call sites
   * unchanged; set false where a right-click should stay the browser's.
   */
  contextArea?: boolean;
}) {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const open = origin !== null;

  const close = useCallback(() => {
    setOrigin(null);
    setPlacement(null);
  }, []);

  /* THE LIST OPENS ON THE SIDE THAT HAS ROOM, and it hangs off the trigger's
     own edge either way.

     It used to always align its RIGHT edge to the trigger's right edge, which
     is correct for a control at the end of a wide row and wrong for every one
     that is not. The block and node handles sit in a narrow left gutter, so a
     192px list opening leftwards from a 24px control landed almost entirely
     past it, over the page margin — a menu that reads as belonging to nothing.
     Preferring the reading direction, and falling back to `end` only when the
     list would not fit, keeps it attached to the thing it acts on. */
  const openAtTrigger = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const roomAfter = window.innerWidth - rect.left - EDGE;
    const alignStart = roomAfter >= MIN_WIDTH;
    setOrigin({
      x: alignStart ? rect.left : rect.right,
      y: rect.bottom + GAP,
      below: window.innerHeight - rect.bottom - GAP,
      above: rect.top - GAP,
      align: alignStart ? "start" : "end",
    });
  }, []);

  const openAtPoint = useCallback((x: number, y: number) => {
    setOrigin({
      x,
      y,
      below: window.innerHeight - y,
      above: y,
      align: "start",
    });
  }, []);

  /* Right-click on the row. Bound to the parent element rather than to a ref
     the caller passes, so adding this cost the call sites nothing. */
  useEffect(() => {
    if (!contextArea) return;
    const row = root.current?.parentElement;
    if (!row) return;

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      openAtPoint(event.clientX, event.clientY);
    };
    row.addEventListener("contextmenu", onContextMenu);
    return () => row.removeEventListener("contextmenu", onContextMenu);
  }, [contextArea, openAtPoint]);

  /* Measured AFTER the list exists and BEFORE paint: the height decides whether
     it opens downward or flips, and a frame with the wrong answer is a menu
     that visibly jumps. */
  useLayoutEffect(() => {
    if (!origin) return;
    const node = list.current;
    if (!node) return;

    const { width, height } = node.getBoundingClientRect();
    const flip = origin.below < height && origin.above > origin.below;
    const top = flip
      ? Math.max(EDGE, origin.above - height + GAP)
      : Math.min(origin.y, window.innerHeight - height - EDGE);

    const wanted = origin.align === "end" ? origin.x - Math.max(width, MIN_WIDTH) : origin.x;
    const left = Math.min(
      Math.max(EDGE, wanted),
      Math.max(EDGE, window.innerWidth - Math.max(width, MIN_WIDTH) - EDGE),
    );

    setPlacement({ top: Math.max(EDGE, top), left });
  }, [origin]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      // Focus goes back where it came from, or the author is left at the top of
      // the document with no idea which row they were on.
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // Both, because the list is no longer a descendant of the root: it lives
      // on `document.body`.
      if (root.current?.contains(target) || list.current?.contains(target)) return;
      close();
    };
    /* A scroll moves the row out from under a fixed list. Closing is the honest
       answer — repositioning would keep a menu pinned to a row the reader has
       already scrolled past. */
    const onScroll = () => close();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  /* Written once and used by both branches below: a grouped section and an
     ungrouped run draw exactly the same row, and two copies of it is how the
     two drift apart. `index` is the position in the FLAT list, so `danger` and
     `startsGroup` still read their true neighbour across a section boundary. */
  const renderItem = ({ item, index, opensSection }: Entry) => (
    <button
      key={item.label}
      className={item.danger ? styles.menuItemDanger : styles.menuItem}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      title={item.hint ?? item.label}
      data-first-danger={item.danger && !items[index - 1]?.danger ? "" : undefined}
      /* Not under a caption: the caption is already the rule, and drawing both
         gives the section a double edge. */
      data-group-start={item.startsGroup && index > 0 && !opensSection ? "" : undefined}
      onClick={() => {
        close();
        item.onSelect();
      }}
    >
      {item.icon ? (
        <Icon className={styles.menuItemIcon} name={item.icon} size={16} />
      ) : (
        <span className={styles.menuItemIcon} aria-hidden="true" />
      )}
      <span className={styles.menuItemLabel}>{item.label}</span>
    </button>
  );

  return (
    <div className={styles.menuRoot} ref={root}>
      <button
        ref={trigger}
        className={styles.menuTrigger}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : openAtTrigger())}
      >
        {/* Positioned so it paints ABOVE the scrim the course card draws in
            `::before`: an absolutely positioned pseudo-element outranks in-flow
            content, and the builder's layering rule keeps `z-index` for the
            six overlay rungs, so tree order is what settles it here. */}
        <Icon className={styles.menuTriggerGlyph} name="more" size={18} />
        {/* Same as every other icon control in the shell — and the rules for it
            (`.menuTrigger:hover .inkRing`, `[aria-expanded="true"] .inkRing`)
            were already written; only the graphic was missing. */}
        <HandGraphic className={styles.inkRing} name="ink-ring" size={42} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={list}
              className={styles.menuList}
              role="menu"
              aria-label={label}
              /* Hidden until measured, not unmounted: the measurement needs the
                 real rendered size, so the list has to exist for one frame
                 first. `visibility` keeps it out of sight without taking it out
                 of layout, which is what the measurement reads. */
              style={
                placement
                  ? { top: `${placement.top}px`, left: `${placement.left}px` }
                  : { top: 0, left: 0, visibility: "hidden" }
              }
            >
              {groupItems(items).map((group, groupIndex) =>
                group.section === undefined ? (
                  /* One subject: no heading, no wrapper — the plain list every
                     other call site has always rendered. */
                  <Fragment key={`group-${groupIndex}`}>{group.entries.map(renderItem)}</Fragment>
                ) : (
                  /* `role="group"` is a legal child of `role="menu"`, and its
                     `aria-label` is what a screen reader announces on entering
                     the group — so the caption itself is `aria-hidden`, or the
                     subject would be read twice before the first item. */
                  <div
                    key={`group-${groupIndex}`}
                    className={styles.menuSection}
                    role="group"
                    aria-label={group.section}
                  >
                    <span className={styles.menuSectionLabel} aria-hidden="true">
                      {group.section}
                    </span>
                    {group.entries.map(renderItem)}
                  </div>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
