"use client";

/**
 * The row's overflow menu.
 *
 * WHY IT EXISTS. A structure row used to carry six things on one line — day,
 * title, block count, up, down, delete — and at 360px the three controls took
 * 147 of the row's 347 pixels, leaving 54 for the title. Ukrainian words are
 * long; the title came out one word per line and the page grew a horizontal
 * scroll. One control instead of three gives the title back ~270px, which is
 * the whole fix.
 *
 * WHY NOT DRAG-AND-DROP INSTEAD. Reordering by drag needs a long-press, a
 * scroll lock and an autoscroll edge to work on touch at all, and is
 * unreachable from a keyboard without building a second control beside it.
 * The menu IS that second control, so it stays the only one.
 *
 * Behaviour is the boring, correct set: Escape closes, a click outside closes,
 * focus returns to the trigger, and the trigger reports `aria-expanded`. The
 * native `popover` attribute would give the first two for free, but positioning
 * it against the trigger still needs CSS anchor positioning, which is not yet
 * safe across the browsers an author might open this in.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Builder.module.css";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Destructive items sit last, behind a divider, in the boundary tone. */
  danger?: boolean;
};

export function BuilderMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus goes back where it came from, or the author is left at the top of
      // the document with no idea which row they were on.
      trigger.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.menuRoot} ref={root}>
      <button
        ref={trigger}
        className={styles.menuTrigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="more" size={18} />
      </button>

      {open ? (
        <div className={styles.menuList} role="menu">
          {items.map((item, index) => (
            <button
              key={item.label}
              className={item.danger ? styles.menuItemDanger : styles.menuItem}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              data-first-danger={item.danger && !items[index - 1]?.danger ? "" : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
