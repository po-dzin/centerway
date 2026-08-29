"use client";

/**
 * The offer's action, kept within thumb reach on a phone.
 *
 * WHY IT EXISTS. On a desktop the hero and the checkout panel are both a short
 * scroll apart and the page is read in one posture. On a phone the same page is
 * a long column: by the time someone has read what is inside, the buy button is
 * several screens behind them and the next one is several screens ahead. The
 * bar is what stops "I want this" from costing a scroll to act on.
 *
 * WHY IT HIDES WHEN A REAL CTA IS ON SCREEN. Two buy buttons visible at once is
 * the page asking twice, and the fixed one covers content while it does. So it
 * watches every element marked `data-cw-offer-cta` and stays down while any of
 * them is in view — the same rule the funnel landings use, for the same reason.
 * An IntersectionObserver rather than a scroll listener: this must not run code
 * on every frame of a touch scroll.
 *
 * MOBILE ONLY, and that is decided in CSS rather than here. A JS breakpoint
 * would disagree with the stylesheet's at some width, and the one that matters
 * is the stylesheet's.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { useOfferAccess } from "@/components/platform/OfferAccess";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import styles from "./PlatformOfferCommerce.module.css";

export function OfferStickyBar({
  price,
  buyHref,
  buyLabel,
}: {
  /** The quoted figure, already formatted. Null for an offer with no agreed price. */
  price: string | null;
  buyHref: string;
  buyLabel: string;
}) {
  const access = useOfferAccess();
  const surfaceHref = useSurfaceHref();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-cw-offer-cta]"));
    // No marked CTA anywhere means nothing to hide behind — but it also means
    // the page is not the shape this bar was written for, so it stays down
    // rather than floating over an unknown layout.
    if (targets.length === 0) return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setShown(visible.size === 0);
      },
      // A CTA half off the bottom of the screen is still a CTA the thumb can
      // reach, so it counts as visible.
      { threshold: 0.1 }
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [
    // Re-observed when ownership lands, because the hero swaps its action node
    // and the old one is no longer in the document.
    access.state,
  ]);

  const owned = access.state === "owned";

  if (owned) {
    const { shelf } = access;
    const finished = shelf.standing?.isFinished ?? false;
    const resumeHref =
      shelf.access === "enrolled" && shelf.currentLessonSlug && !finished
        ? `/learn/${shelf.slug}/${shelf.currentLessonSlug}`
        : `/learn/${shelf.slug}`;

    return (
      <div className={styles.stickyBar} data-shown={shown}>
        <Link className={styles.stickyAction} href={surfaceHref(resumeHref)}>
          {finished ? "Відкрити курс" : shelf.access === "available" ? "Почати навчання" : "Продовжити навчання"}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.stickyBar} data-shown={shown}>
      {/* The price sits beside the button rather than inside it: a button whose
          label is a number is a button people press to find out what it costs. */}
      {price ? (
        <p className={styles.stickyPrice}>
          <span>{price}</span>
        </p>
      ) : null}
      {/* A plain anchor when it is a checkout, exactly as the panel's button is:
          /api/pay/start creates an order on GET, and a prefetched next/link
          would open an invoice for everyone who scrolled past. */}
      {buyHref.startsWith("/api/") ? (
        <a className={styles.stickyAction} href={buyHref} rel="nofollow">
          {buyLabel}
        </a>
      ) : (
        <Link className={styles.stickyAction} href={buyHref}>
          {buyLabel}
        </Link>
      )}
    </div>
  );
}
