"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkIcon, InteractionInkLabel } from "@/components/platform/InteractionInk";
import { useI18n } from "@/components/I18nProvider";
import cal from "@/components/admin/AdminCalendar.module.css";
import controls from "@/components/admin/AdminControls.module.css";
import type { DateRange } from "@/lib/admin/analytics/types";
import {
  buildMonthGrid,
  buildPresetRange,
  detectActivePreset,
  formatDateLocal,
  isoToDate,
  normalizeDateRange,
  type RangePresetKey,
} from "@/lib/admin/analytics/format";

/* The range control: a text pair, a two-month grid and five presets. Its own
   file because it is 215 lines of calendar that has nothing to do with the
   dashboard it sits above — and because everything it computes now comes from
   format.ts, where it can be tested. */
type DateRangePickerProps = {
  value: DateRange;
  onApply: (next: DateRange) => Promise<void> | void;
  applyLabel: string;
  locale: string;
  className?: string;
};

export function DateRangePicker({ value, onApply, applyLabel, locale, className = "" }: DateRangePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draftRange, setDraftRange] = useState<DateRange>(() => normalizeDateRange(value));
  const selectedFromDate = useMemo(() => isoToDate(draftRange.from), [draftRange.from]);
  const [viewMonth, setViewMonth] = useState<Date>(() => selectedFromDate ?? new Date());

  useEffect(() => {
    if (!open) {
      setDraftRange(normalizeDateRange(value));
      setSelectingEnd(false);
    }
  }, [open, value]);

  useEffect(() => {
    if (open && selectedFromDate) {
      setViewMonth(new Date(selectedFromDate.getFullYear(), selectedFromDate.getMonth(), 1));
    }
  }, [open, selectedFromDate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewMonth);
  const dayNames = useMemo(() => {
    const monday = new Date(Date.UTC(2024, 0, 1)); // Monday
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + idx);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
    });
  }, [locale]);
  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayIso = formatDateLocal(new Date());
  const activePreset = detectActivePreset(draftRange);

  const formatDisplayDate = (iso: string) => {
    const date = isoToDate(iso);
    if (!date) return "YYYY-MM-DD";
    return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const selectDate = (iso: string) => {
    if (iso > todayIso) return;
    if (!selectingEnd) {
      setDraftRange({ from: iso, to: iso });
      setSelectingEnd(true);
      return;
    }
    const next = normalizeDateRange({ from: draftRange.from, to: iso });
    setDraftRange(next);
    setSelectingEnd(false);
  };

  const applyRange = async () => {
    const normalized = normalizeDateRange(draftRange);
    setDraftRange(normalized);
    setSelectingEnd(false);
    setOpen(false);
    await onApply(normalized);
  };

  const applyPresetQuick = async (preset: RangePresetKey) => {
    const next = normalizeDateRange(buildPresetRange(preset));
    setDraftRange(next);
    setSelectingEnd(false);
    setOpen(false);
    await onApply(next);
  };

  const renderMonth = (monthDays: Date[], monthDate: Date) => (
    <div>
      <div className={cal.grid}>
        {dayNames.map((name) => (
          <div key={`${monthDate.getMonth()}-${name}`} className={cal.weekday}>
            {name}
          </div>
        ))}
      </div>
      <div className={cal.grid}>
        {monthDays.map((day) => {
          const iso = formatDateLocal(day);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isFuture = iso > todayIso;
          const isStart = draftRange.from === iso;
          const isEnd = draftRange.to === iso;
          const isSingle = isStart && isEnd;
          const inRange = iso >= draftRange.from && iso <= draftRange.to;
          const isToday = iso === todayIso;

          const classes = [cal.day];
          if (!isFuture && inRange) {
            classes.push(cal.dayInRange);
            if (isSingle) classes.push(cal.dayRangeSingle);
            else if (isStart) classes.push(cal.dayRangeStart);
            else if (isEnd) classes.push(cal.dayRangeEnd);
          } else if (!isFuture && !isCurrentMonth) {
            classes.push(cal.dayOutside);
          }
          if (isToday && !inRange && !isFuture) classes.push(cal.dayToday);

          return (
            <button
              key={`${monthDate.getMonth()}-${iso}`}
              type="button"
              disabled={isFuture}
              onClick={() => selectDate(iso)}
              className={classes.join(" ")}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`${cal.range} ${className}`.trim()}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} className={cal.trigger}>
        <span className={cal.triggerText}>
          {formatDisplayDate(draftRange.from)} - {formatDisplayDate(draftRange.to)}
        </span>
        <Icon className="cw-muted" name="calendar" size={16} />
      </button>

      {open && (
        <div className={cal.popoverUnderTrigger}>
          <div className={cal.head}>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="cw-icon-btn"
              aria-label={t("common_prev_month")}
            >
              <InteractionInkIcon>
                <Icon name="arrow-left" size={16} />
              </InteractionInkIcon>
            </button>
            <div className={cal.monthLabel}>{monthLabel}</div>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="cw-icon-btn"
              aria-label={t("common_next_month")}
            >
              <InteractionInkIcon>
                <Icon name="arrow-right" size={16} />
              </InteractionInkIcon>
            </button>
          </div>

          {renderMonth(days, viewMonth)}

          <div className={cal.foot}>
            <div className={cal.presets}>
              {(["7d", "30d", "mtd", "90d", "1y"] as RangePresetKey[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-cw-ink-control
                  aria-pressed={activePreset === preset}
                  onClick={() => {
                    void applyPresetQuick(preset);
                  }}
                  className={cal.preset}
                >
                  <InteractionInkLabel>{preset.toUpperCase()}</InteractionInkLabel>
                </button>
              ))}
            </div>
            <button type="button" onClick={applyRange} className={controls.action}>
              {applyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
