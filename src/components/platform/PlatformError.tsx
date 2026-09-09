"use client";

import Link from "next/link";

import offerStyles from "@/components/platform/PlatformOfferStyles";
import styles from "@/components/platform/PlatformOfferCommerce.module.css";

/**
 * What a crash says, written once for the two places that have to say it —
 * the mirror of `PlatformNotFoundPanel` for the other way a page can fail to
 * render.
 *
 * UNTIL 2026-09-09 THERE WAS NO SECOND PLACE: no `error.tsx` existed anywhere
 * in this app, at any level. A render that threw did not fall back to
 * anything — React unmounted the tree and left whatever was on screen when
 * it did, with only a console error to say why. That is what "the page falls
 * apart" was: a reader restored from the back/forward cache into a stale
 * render (see `BfcacheRestore.tsx`) hit an exception with nothing between it
 * and a blank screen.
 *
 * TWO EXITS, NOT ONE. `reset()` re-renders this segment in place and is the
 * right first try — most of what reaches here is a transient render failure,
 * not a broken route. But it cannot undo stale module state or a JS heap left
 * over from whatever produced the crash, so the second exit is a real
 * navigation: a link, not a button, so the browser actually reloads the
 * document rather than asking the same broken runtime to try again.
 */
export function PlatformErrorPanel({ onRetry }: { onRetry?: () => void }) {
  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="support"
      data-cw-semantic-family="support-boundary"
      data-cw-token-source="global-app-ds"
    >
      <article className={`${offerStyles.panel} ${styles.statusPanel}`}>
        <p className={offerStyles.label}>Сталася помилка</p>
        <h1 className={offerStyles.title}>Щось пішло не так</h1>
        <p className={offerStyles.lead}>
          Сторінка не змогла відкритися. Спробуйте ще раз — якщо не допоможе, поверніться на
          головну: усе, що ви вже проходите, лишається на місці, у вашому кабінеті.
        </p>

        <div className={styles.statusActions}>
          {onRetry ? (
            <button type="button" className={styles.statusPrimaryAction} onClick={onRetry}>
              Спробувати ще раз
            </button>
          ) : null}
          <Link className={onRetry ? styles.statusSecondaryAction : styles.statusPrimaryAction} href="/">
            На головну
          </Link>
        </div>
      </article>
    </section>
  );
}
