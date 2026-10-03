"use client";

import { useEffect, useState } from "react";

import { plural } from "@/lib/plural";
import css from "./OfferFormats.module.css";

/**
 * The early price's quiet timer (G, 2026-10-03, «Оптимізація 1»).
 *
 * Days, hours and minutes to the real date stored on the offer — never
 * seconds, and nothing that resets on reload: it is a fact of the schedule
 * read off the clock, not a pressure device. Under it, one line says the whole
 * ladder: «До 15 жовтня 3 400 ₴, далі 4 100 ₴».
 *
 * The bar fills over the last fortnight of the window: a stretch long enough
 * to read as calm and short enough to move while someone is deciding.
 *
 * When the date arrives while the page is open, it is loaded again, and the card comes back at
 * its regular price — the checkout already charges it from that minute.
 */

const MINUTE = 60_000;
const BAR_WINDOW = 14 * 24 * 60 * MINUTE;

function parts(left: number) {
  const minutes = Math.max(0, Math.floor(left / MINUTE));
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function EarlyPriceTimer({ endsAt, renderedAt, line }: { endsAt: string; renderedAt: number; line: string }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(tick);
    };
  }, []);

  const left = end - now;
  const expired = left <= 0;
  useEffect(() => {
    // Only when it ran out while open: a page served after the date already
    // carries the regular price and never renders this timer.
    if (expired && Date.now() > renderedAt + MINUTE) window.location.reload();
  }, [expired, renderedAt]);

  if (expired) return null;
  const { days, hours, minutes } = parts(left);
  const filled = Math.min(1, Math.max(0, 1 - left / BAR_WINDOW));

  return (
    <div className={css.early}>
      <div className={css.earlyHead}>
        <p className={css.earlyLabel}>Рання ціна діє ще</p>
        <p
          className={css.earlyClock}
          aria-label={`${days} ${plural(days, "день", "дні", "днів")} ${hours} год ${minutes} хв`}
        >
          <span>
            <b>{pad(days)}</b>
            <small>{plural(days, "день", "дні", "днів")}</small>
          </span>
          <span>
            <b>{pad(hours)}</b>
            <small>год</small>
          </span>
          <span>
            <b>{pad(minutes)}</b>
            <small>хв</small>
          </span>
        </p>
      </div>
      <span className={css.earlyBar} aria-hidden="true">
        <span style={{ inlineSize: `${Math.round(filled * 100)}%` }} />
      </span>
      <p className={css.earlyLine}>{line}</p>
    </div>
  );
}
