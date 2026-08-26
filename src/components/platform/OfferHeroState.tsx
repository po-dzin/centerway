"use client";

/**
 * The two halves of the hero that depend on who is reading it.
 *
 * `OfferHeroCommitment` is the line between the facts and the buttons: a price
 * for someone deciding, a standing for someone who already decided.
 * `OfferHeroActions` is the buttons themselves.
 *
 * WHY TWO COMPONENTS AND NOT ONE. They sit either side of nothing in the DOM,
 * but the hero owns the space between them, and a single component spanning
 * both would have had to render the gap too — which is how a layout ends up
 * with a wrapper that exists only because a component boundary was drawn in the
 * wrong place.
 *
 * Both render the anonymous state while access is `unknown`. That is the whole
 * point of the `unknown` state: a paying learner sees the buy button for the
 * length of one request, which is recoverable, whereas an anonymous visitor
 * seeing «Продовжити навчання» is a broken page.
 */

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useOfferAccess } from "@/components/platform/OfferAccess";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import styles from "@/components/platform/PlatformHeroStyles";

export type OfferHeroCommerce = {
  /**
   * The quoted figure, already formatted — "795 ₴". Null for a lead-form offer,
   * which has no price to print because nobody has agreed one.
   *
   * Always the LIST price. The charged amount and the quoted one diverge while
   * the 1 ₴ QA window is open, and a hero reading the charged figure would
   * advertise a hryvnia.
   */
  price: string | null;
  /** The author's own access promise — "доступ назавжди". */
  accessNote: string | null;
};

/** Where the outline is, so a reader who owns the course can jump straight to it. */
const PLAN_ANCHOR = "#program-plan";

export function OfferHeroCommitment({ commerce }: { commerce: OfferHeroCommerce }) {
  const access = useOfferAccess();

  if (access.state !== "owned") {
    if (!commerce.price) return null;
    return (
      <div className={styles.heroPriceRow}>
        <p className={styles.heroPriceValue}>{commerce.price}</p>
        <p className={styles.heroPriceNote}>{commerce.accessNote ?? "разова оплата"}</p>
      </div>
    );
  }

  const { shelf } = access;
  const standing = shelf.standing;
  const finished = standing?.isFinished ?? false;
  const total = standing?.totalLessons ?? 0;
  const done = standing?.completedLessons ?? 0;

  return (
    <>
      <div className={styles.heroStatusRow}>
        <span className={styles.heroStatusBadge}>
          <Icon name={finished ? "check" : "shield-check"} size={20} />
          {finished ? "Пройдено" : "Активна"}
        </span>
        <p className={styles.heroStatusNote}>
          {shelf.access === "available"
            ? "Курс відкрито — можна починати."
            : finished
              ? "Курс пройдено. Протокол можна повторити будь-коли."
              : total > 0
                ? `Пройдено ${done} з ${total}`
                : "Курс відкрито у вашому кабінеті."}
        </p>
      </div>
      {/* The bar is drawn only when there is a real fraction to draw. A rail at
          zero on a course nobody has started yet reads as a stalled download. */}
      {total > 0 && done > 0 && !finished ? (
        <div
          className={styles.heroProgressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={`Пройдено ${done} з ${total} уроків`}
        >
          <div className={styles.heroProgressFill} style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      ) : null}
    </>
  );
}

export function OfferHeroActions({
  buyHref,
  buyLabel,
  secondaryLabel,
}: {
  /** The checkout anchor for a visitor who does not own this yet. */
  buyHref: string;
  buyLabel: string;
  secondaryLabel: string;
}) {
  const access = useOfferAccess();
  const surfaceHref = useSurfaceHref();

  if (access.state !== "owned") {
    // `data-cw-offer-cta` marks this as a real call to action, so the phone's
    // thumb bar stays down while it is on screen — two buy buttons at once is
    // the page asking twice.
    return (
      <div className={styles.heroFeatureActions} data-cw-offer-cta>
        <Link className={styles.heroPrimaryButton} href={buyHref}>
          {buyLabel}
        </Link>
        <Link className={styles.heroSecondaryButton} href={PLAN_ANCHOR}>
          <span>{secondaryLabel}</span>
        </Link>
      </div>
    );
  }

  const { shelf } = access;
  const finished = shelf.standing?.isFinished ?? false;
  // Straight to where they stopped, not to the course index — the index is one
  // more click to reach a lesson they were already in the middle of.
  const resumeHref =
    shelf.access === "enrolled" && shelf.currentLessonSlug && !finished
      ? `/learn/${shelf.slug}/${shelf.currentLessonSlug}`
      : `/learn/${shelf.slug}`;

  const label = shelf.access === "available" ? "Почати навчання" : finished ? "Відкрити курс" : "Продовжити навчання";

  return (
    <div className={styles.heroFeatureActions} data-cw-offer-cta>
      <Link className={styles.heroPrimaryButton} href={surfaceHref(resumeHref)}>
        {label}
      </Link>
      <Link className={styles.heroSecondaryButton} href={PLAN_ANCHOR}>
        <span>Програма курсу</span>
      </Link>
    </div>
  );
}
