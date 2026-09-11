"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
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
    <div className="w-full">
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {dayNames.map((name) => (
          <div
            key={`${monthDate.getMonth()}-${name}`}
            className="h-6 text-[10px] cw-muted flex items-center justify-center uppercase"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[32px] gap-0">
        {monthDays.map((day) => {
          const iso = formatDateLocal(day);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isFuture = iso > todayIso;
          const isStart = draftRange.from === iso;
          const isEnd = draftRange.to === iso;
          const isSingle = isStart && isEnd;
          const inRange = iso >= draftRange.from && iso <= draftRange.to;
          const isToday = iso === todayIso;
          const rangeShapeClass = isSingle
            ? "rounded-md border-[var(--cw-interactive-active-border)]"
            : isStart
              ? "rounded-l-md rounded-r-none border-r-0 border-[var(--cw-interactive-active-border)]"
              : isEnd
                ? "rounded-r-md rounded-l-none border-l-0 border-[var(--cw-interactive-active-border)]"
                : "rounded-none border-transparent";

          return (
            <button
              key={`${monthDate.getMonth()}-${iso}`}
              type="button"
              disabled={isFuture}
              onClick={() => selectDate(iso)}
              className={`h-8 border text-xs transition-colors ${
                isFuture
                  ? "border-transparent cw-muted opacity-35 cursor-not-allowed"
                  : inRange
                    ? `cw-text bg-[var(--cw-interactive-active-bg)] ${rangeShapeClass}`
                    : isCurrentMonth
                      ? "border-transparent cw-text hover:bg-[var(--cw-interactive-hover-bg)] rounded-md"
                      : "border-transparent cw-muted opacity-65 hover:bg-[var(--cw-interactive-hover-bg)] rounded-md"
              } ${isToday && !inRange && !isFuture ? "border cw-border" : ""} ${isSingle || isStart || isEnd ? "font-semibold" : ""}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative w-full sm:w-[340px] ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cw-input w-full h-10 px-3 text-sm flex items-center justify-between gap-2"
      >
        <span className="cw-text truncate">
          {formatDisplayDate(draftRange.from)} - {formatDisplayDate(draftRange.to)}
        </span>
        <Icon className="cw-muted" name="calendar" size={16} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-40 w-full cw-surface-solid border cw-border rounded-xl cw-shadow p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="cw-icon-btn"
              aria-label="Previous month"
            >
              <InteractionInkIcon>
                <Icon name="arrow-left" size={16} />
              </InteractionInkIcon>
            </button>
            <div className="text-sm font-semibold cw-text capitalize">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="cw-icon-btn"
              aria-label="Next month"
            >
              <InteractionInkIcon>
                <Icon name="arrow-right" size={16} />
              </InteractionInkIcon>
            </button>
          </div>

          {renderMonth(days, viewMonth)}

          <div className="flex items-center gap-1.5 border-t cw-border pt-2">
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              {(["7d", "30d", "mtd", "90d", "1y"] as RangePresetKey[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    void applyPresetQuick(preset);
                  }}
                  className={`h-7 min-w-9 px-1.5 text-[11px] rounded-md border transition-colors ${
                    activePreset === preset
                      ? "cw-text border-[var(--cw-interactive-active-border)] bg-[var(--cw-interactive-active-bg)]"
                      : "cw-btn-muted border-[var(--cw-border)] hover:bg-[var(--cw-interactive-hover-bg)]"
                  }`}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={applyRange} className="h-8 px-2.5 text-sm font-medium cw-btn shrink-0">
              {applyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
