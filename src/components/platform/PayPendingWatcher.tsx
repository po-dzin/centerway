"use client";

/**
 * Waits for the payment to resolve, then sends the buyer where they belong.
 *
 * It decides nothing itself. Once the status endpoint reports that the payment
 * has resolved, it hands the browser back to `/pay/return`, which is the one
 * place that knows a paid course goes to its own page while a bot delivery goes
 * to the confirmation screen. Duplicating that rule here is how the two would
 * come to disagree.
 *
 * When the wait runs long it stops polling and says so, rather than spinning
 * forever: past a couple of minutes the answer is a person, not another poll.
 * It never says the payment failed — it does not know that, and claiming it is
 * the exact bug this whole screen exists to undo.
 *
 * THE LOOP LIVES INSIDE ONE EFFECT RUN, and that is load-bearing rather than
 * stylistic. An earlier version kept the attempt count in state and let the
 * effect re-run on each tick; every re-run's cleanup then flipped the
 * `cancelled` flag that the in-flight request was about to check, so each poll
 * was aborted a moment after it was sent. The requests went out, all of them
 * answered, and not one answer was ever acted on — a watcher that watched
 * nothing. Only a browser catches that: the network tab looks perfect.
 */

import { useEffect, useState } from "react";

import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import styles from "./PlatformSurfaceStyles";

/** Polite to the endpoint, immediate to the eye. */
const POLL_INTERVAL_MS = 2500;
/** Roughly two minutes of waiting before we hand over to support. */
const MAX_ATTEMPTS = 48;

export function PayPendingWatcher({ orderRef, product }: { orderRef: string; product: string | null }) {
  const [gaveUp, setGaveUp] = useState(false);
  /** Bumped by "check again", which is the only way to restart a finished loop. */
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    function resolveNow() {
      const params = new URLSearchParams({ order_ref: orderRef });
      if (product) params.set("product", product);
      window.location.replace(`/pay/return?${params.toString()}`);
    }

    async function tick() {
      if (cancelled) return;
      attempts += 1;

      try {
        const res = await fetch(`/api/pay/status?order_ref=${encodeURIComponent(orderRef)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { status?: string };
          if (cancelled) return;
          if (body.status === "paid" || body.status === "failed") {
            resolveNow();
            return;
          }
        }
      } catch {
        /* A failed poll is not a failed payment. The next tick tries again. */
      }

      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setGaveUp(true);
        return;
      }
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    }

    /* The first look is immediate: the callback often lands in the moment
       between the redirect and this component mounting. */
    void tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderRef, product, round]);

  if (!gaveUp) return null;

  return (
    <div className={styles.form}>
      <p className={styles.status}>
        Підтвердження від банку йде довше за звичайне. Гроші при цьому в безпеці: якщо оплата пройшла,
        доступ відкриється автоматично, а якщо ні — кошти повернуться на картку. Платити вдруге не потрібно.
      </p>
      <button
        className={styles.secondaryButton}
        type="button"
        onClick={() => {
          setGaveUp(false);
          setRound((n) => n + 1);
        }}
      >
        Перевірити ще раз
      </button>
      <a className={styles.secondaryButton} href={SUPPORT_BOT_URL} target="_blank" rel="noopener noreferrer">
        Написати в підтримку
      </a>
    </div>
  );
}
