"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LogoMark } from "@/components/brand/LogoMark";
import styles from "./CheckoutStartLink.module.css";

/**
 * THE ONE CONTROL THAT STARTS A CHECKOUT, and the only one allowed to.
 *
 * WHY IT EXISTS. `/api/pay/start` creates an order and then waits on
 * WayForPay's CREATE_INVOICE round trip before it can redirect — about two
 * seconds. For those two seconds the anchor it lives in did nothing visible at
 * all: no pressed state, no label change, nothing. So a reader who tapped and
 * saw stillness tapped again, and each tap raised another invoice.
 *
 * That is not a hypothesis. The first organic sale (2026-09-10) arrived as
 * THREE orders inside four seconds — 08:09:22, :24, :26 — of which the third
 * was paid and the first two expired. The same buyer had produced twelve orders
 * over two days. Every one of them is a row in `orders`, a `checkout_started`
 * event and an InitiateCheckout to Meta, so the silence was not only rude to
 * her; it made the funnel unreadable.
 *
 * HOW IT WAITS is not a new decision. `docs/design-system.md` → "One way to
 * wait (2026-09-06)": the mark gaining density in turn is the waiting state,
 * and a control in flight says so in words with an ellipsis. A rotating circle
 * says «something is happening» without saying what — and belongs to no design
 * system in particular. This adds no third answer; it uses that one.
 *
 * STILL A PLAIN ANCHOR, for the two reasons the surfaces it replaced each
 * wrote out in their own comments: `next/link` would PREFETCH a route handler
 * that raises an invoice, opening one for everybody who scrolled past, and a
 * native navigation keeps working when this component's JavaScript does not.
 * The click handler only decorates a navigation the browser is already doing —
 * it never performs one, so nothing here can strand a reader on a dead button.
 *
 * WHY THE SECOND CLICK IS SWALLOWED AND NOT THE FIRST. Disabling an anchor is
 * not a thing HTML offers, and `pointer-events: none` would also swallow the
 * first click on a slow paint. `preventDefault` on every click after the one
 * that armed it is precise: the navigation the reader asked for proceeds, and
 * the ones they did not mean to ask for do not.
 */
export function CheckoutStartLink({
  href,
  className,
  label,
  pendingLabel = "Відкриваємо оплату…",
  markSize = 20,
  isPageCta = true,
}: {
  href: string;
  className?: string;
  label: string;
  /** Overridable because the sticky bar's label is shorter than the panel's. */
  pendingLabel?: string;
  markSize?: number;
  /**
   * Whether this control is one of the page's own buy buttons.
   *
   * `OfferStickyBar` hides itself while any element marked `data-cw-offer-cta`
   * is in view — that is how the page avoids asking twice. The bar's OWN button
   * must therefore not carry the mark: it is always in view when the bar is up,
   * so marking it would make the bar hide from itself, come back, and hide
   * again. Every in-page CTA passes this as true; the bar passes false.
   */
  isPageCta?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const armed = useRef(false);

  /* COMING BACK MUST NOT FIND IT STILL WAITING.
     Two returns land here and neither is a fresh render: the back button
     restores this page from the bfcache with its React state intact, and a
     reader who left for the gateway in another tab comes back to a document
     that never unmounted. A button still reading «Відкриваємо оплату…» would
     then be a control that has stopped working, which is worse than the
     silence this component was written to fix. */
  useEffect(() => {
    const clear = () => {
      armed.current = false;
      setPending(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") clear();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const onClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    /* A modified click opens a tab and leaves THIS page where it is, so the
       control here is not in flight and must not claim to be. */
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    if (armed.current) {
      event.preventDefault();
      return;
    }
    armed.current = true;
    setPending(true);
  }, []);

  return (
    <a
      className={[className, styles.control].filter(Boolean).join(" ")}
      href={href}
      rel="nofollow"
      data-cw-offer-cta={isPageCta ? "" : undefined}
      data-pending={pending ? "true" : undefined}
      aria-busy={pending ? true : undefined}
      onClick={onClick}
    >
      {/* Both labels are always in the DOM and one of them is hidden, so the
          button cannot change width at the moment it is pressed — a control
          that resizes under the finger reads as a misfire. */}
      <span className={styles.rest} aria-hidden={pending}>
        {label}
      </span>
      <span className={styles.wait} aria-hidden={!pending}>
        {/* NO `tone` HERE, deliberately — the mark follows the button's own
            label colour. `tone="brand"` is ink on the day ground and GOLD on
            the night one, which is right on a page and wrong inside a filled
            button: this button IS gold, so a gold mark would vanish into it
            after dark. Same rule the canon states as «ink marks text; a box
            marks itself» — a filled control speaks with what it is, and what
            sits inside it speaks with the control. */}
        <LogoMark size={markSize} animate="wait" aria-hidden />
        <span>{pendingLabel}</span>
      </span>
    </a>
  );
}
