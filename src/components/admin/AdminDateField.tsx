"use client";

/**
 * A date field that belongs to this design system.
 *
 * WHY NOT `<input type="date">`. Because the calendar it opens is not ours and
 * cannot be made ours: it is drawn by the browser, in the browser's colours, at
 * the browser's size, with the browser's idea of the first day of the week. On
 * a dark panel it opens a light-grey Chrome popup with English weekday initials
 * and a blue selection — the one surface in the panel that ignores every token
 * the rest of it obeys. Styling it is not possible; `::-webkit-calendar-picker-
 * indicator` reaches the little glyph and nothing behind it.
 *
 * WHAT IS KEPT FROM THE NATIVE ONE. Typing. The field is still a text input,
 * still accepts a typed `dd.mm.yyyy`, and the calendar is an aid rather than the
 * only way in — an operator entering thirty deadlines from a list should never
 * have to open a calendar at all.
 *
 * THE VALUE IS STILL `YYYY-MM-DD`, unchanged, so `normalizeDeadline`,
 * `deadlineInputValue` and every caller stay exactly as they were. What the
 * operator SEES is `dd.mm.yyyy`, which is how a date is written here; the two
 * are converted at the edge of this component and nowhere else.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import cal from "@/components/admin/AdminCalendar.module.css";

/**
 * Some Monday, derived rather than asserted.
 *
 * The header row needs seven consecutive days starting on a Monday, and the
 * obvious way to get them — hard-code a date "everyone knows" is a Monday — is
 * how the first version printed НД above the Thursday column: the constant was
 * a Sunday. Normalising an arbitrary date back to its own Monday cannot be
 * wrong about which day it landed on.
 */
const MONDAY = (() => {
  const anchor = new Date(Date.UTC(2024, 0, 1));
  return new Date(Date.UTC(2024, 0, 1 - ((anchor.getUTCDay() + 6) % 7)));
})();

/** `YYYY-MM-DD` → `dd.mm.yyyy`, the written form. */
function toDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/**
 * `dd.mm.yyyy` → `YYYY-MM-DD`, or null while it is not a date yet.
 *
 * The round trip is checked rather than assumed: `31.02.2026` parses into a Date
 * happily and comes back as 3 March, so a field that accepted it would store a
 * day the operator did not type. Comparing the parts back is what catches that.
 */
function fromDisplay(text: string): string | null {
  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(text.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function iso(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfMonth(value: string | null): Date {
  const base = value ? new Date(`${value}T00:00:00Z`) : new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
}

export function AdminDateField({
  value,
  onChange,
  disabled,
  locale,
  labels,
  className = "",
  id,
}: {
  /** `YYYY-MM-DD`, or `""` for none. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  locale: string;
  labels: { open: string; clear: string; today: string; placeholder: string };
  className?: string;
  id?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => toDisplay(value));
  const [month, setMonth] = useState(() => startOfMonth(value || null));
  const root = useRef<HTMLDivElement>(null);

  // The field follows the value when it changes from outside — a row reloaded
  // after a save, or a draft cleared by its own "remove" button.
  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // ON CAPTURE, AND IT CONSUMES THE KEY. This field is used inside
      // AdminModal, which also closes on Escape from a `document`
      // listener — so one press shut the calendar AND the dialog behind
      // it, losing a half-filled form to a keystroke that meant "put this
      // little calendar away". A capture-phase listener on `document`
      // runs before that node's bubble-phase one, so stopping propagation
      // here is what makes the innermost layer the one that answers.
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const commitText = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange("");
        return;
      }
      const parsed = fromDisplay(trimmed);
      // Unparseable input snaps back to the stored value rather than
      // clearing it: half a typed date is not a request to remove one.
      if (parsed) onChange(parsed);
      else setText(toDisplay(value));
    },
    [onChange, value],
  );

  const weeks = useMemo(() => {
    const first = month;
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    // Monday-first, which is the week here — the native picker's Sunday-first
    // grid is one of the things that made it read as somebody else's control.
    const lead = (first.getUTCDay() + 6) % 7;

    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month]);

  const todayIso = iso(new Date());
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const weekdayName = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });

  const pick = (date: Date) => {
    onChange(iso(date));
    setOpen(false);
  };

  return (
    <div ref={root} className={`${cal.anchor} ${className}`.trim()}>
      <div className={cal.field}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={labels.placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText(text);
              setOpen(false);
            }
          }}
          className={cal.fieldInput}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={labels.open}
          aria-expanded={open}
          onClick={() => {
            setMonth(startOfMonth(value || null));
            setOpen((wasOpen) => !wasOpen);
          }}
          className={cal.fieldButton}
        >
          <CalendarGlyph />
        </button>
      </div>

      {open ? (
        <div className={cal.popoverUnderField}>
          <div className={cal.head}>
            {/* THE SAME STEP AS THE PERIOD PICKER (2026-09-13). This was a bare
                `‹` and `›` announced to a screen reader as "←" and "→", while
                the analytics calendar stepped with the sprite's arrows inside
                the ink ring. One calendar, one way to change the month. */}
            <button
              type="button"
              onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}
              className="cw-icon-btn"
              aria-label={t("common_prev_month")}
            >
              <InteractionInkIcon>
                <Icon name="arrow-left" size={16} />
              </InteractionInkIcon>
            </button>
            <span className={cal.monthLabel}>{monthLabel}</span>
            <button
              type="button"
              onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}
              className="cw-icon-btn"
              aria-label={t("common_next_month")}
            >
              <InteractionInkIcon>
                <Icon name="arrow-right" size={16} />
              </InteractionInkIcon>
            </button>
          </div>

          <div className={cal.grid}>
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
              <span key={offset} className={cal.weekday}>
                {weekdayName.format(
                  new Date(Date.UTC(MONDAY.getUTCFullYear(), MONDAY.getUTCMonth(), MONDAY.getUTCDate() + offset)),
                )}
              </span>
            ))}
          </div>

          <div className={cal.grid}>
            {weeks.flat().map((date, index) => {
              if (!date) return <span key={`pad-${index}`} />;
              const dayIso = iso(date);
              const selected = dayIso === value;
              const isToday = dayIso === todayIso;
              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={() => pick(date)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={selected}
                  className={[cal.day, selected ? cal.daySelected : isToday ? cal.dayToday : ""].join(" ").trim()}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className={cal.foot}>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cal.footActionQuiet}
            >
              {labels.clear}
            </button>
            <button type="button" onClick={() => pick(new Date())} className={cal.footAction}>
              {labels.today}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarGlyph() {
  return <Icon name="calendar" size={16} />;
}
