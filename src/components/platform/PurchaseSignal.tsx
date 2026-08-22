"use client";

/**
 * Everything the funnel's thanks page did in the browser, on the platform.
 *
 * Three jobs, in this order, and the order matters:
 *
 * 1. **`PurchaseClientSignal` to /api/events.** The browser's own record that a
 *    buyer reached the confirmation, carrying the attribution the server never
 *    sees — `fbp`, `fbc`, `fbclid`, the utm set — read from the `cw_attrib`
 *    blob the landings write on first touch.
 * 2. **`fbq('track','Purchase')`** with `eventID: purchase_<order_ref>`. That id
 *    is not decorative: the WayForPay webhook sends a server-side Purchase with
 *    the SAME id, and without the pair Meta counts one payment twice.
 * 3. Nothing else. In particular NO auto-redirect — the whole point of moving
 *    this page onto the platform is that the buyer chooses where to go from
 *    real buttons instead of being thrown somewhere after a timer.
 *
 * Fired once per order, guarded in `sessionStorage` under the same keys the
 * static pages use — a buyer who reloads, or who somehow reaches both the old
 * funnel page and this one, produces one event.
 *
 * Renders nothing.
 */

import { useEffect } from "react";

export type PurchaseSignalProps = {
  orderRef: string | null;
  product: string;
  contentName: string;
  transactionId: string | null;
  value: number | null;
  currency: string;
};

type Attribution = Record<string, string>;

function readAttribution(): Attribution {
  try {
    const raw = JSON.parse(localStorage.getItem("cw_attrib") || "{}") as unknown;
    if (!raw || typeof raw !== "object") return {};
    const out: Attribution = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" && value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function markOnce(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) === "1") return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // No session storage: fire anyway. A duplicate is deduplicated downstream
    // by event_id; a missing Purchase is not recoverable.
    return true;
  }
}

export function PurchaseSignal({
  orderRef,
  product,
  contentName,
  transactionId,
  value,
  currency,
}: PurchaseSignalProps) {
  useEffect(() => {
    const id = orderRef || transactionId || "noid";
    const attribution = readAttribution();
    const amount = value !== null && Number.isFinite(value) && value > 0 ? value : 0;

    if (markOnce(`cw_purchase_signal_sent:${id}`)) {
      const body = JSON.stringify({
        event_name: "PurchaseClientSignal",
        event_id: `purchase_client_${orderRef || transactionId || Date.now()}`,
        order_ref: orderRef,
        product,
        value: amount,
        currency,
        content_name: contentName,
        page_url: window.location.href,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        fbclid: attribution.fbclid,
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_content: attribution.utm_content,
        utm_term: attribution.utm_term,
      });

      // sendBeacon first: it survives the buyer pressing a button immediately,
      // which on this page is the expected behaviour rather than an edge case.
      let sent = false;
      try {
        sent = navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" })) ?? false;
      } catch {
        sent = false;
      }
      if (!sent) {
        void fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body,
        }).catch(() => undefined);
      }
    }

    /**
     * `fbq` may not exist yet, and waiting for it is the whole difference
     * between this event firing and not.
     *
     * The pixel loads with `afterInteractive`, so on the first hydration frame
     * — which is exactly when this effect runs — `window.fbq` is often still
     * undefined. An early return here silently dropped the single most
     * important event on the page; the static funnel pages never hit it only
     * because they loaded their pixel synchronously in <head>.
     *
     * Once the snippet has run, `fbq` is a QUEUEING STUB even before
     * fbevents.js arrives, so reaching it is enough — the call is replayed.
     * Staff get a no-op `fbq` from the same provider, so this needs no second
     * opt-out check: one place decides, everywhere else just calls.
     */
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const firePurchase = () => {
      if (typeof window.fbq !== "function") {
        // ~8s, then give up: the server-side Purchase from the WayForPay
        // webhook still lands, so the conversion is not lost — only its
        // browser-side partner.
        if (attempts++ > 40) return;
        timer = setTimeout(firePurchase, 200);
        return;
      }

      if (!markOnce(`cw_purchase_fired:${id}`)) return;

      const payload: Record<string, unknown> = {
        value: amount,
        currency,
        content_name: contentName,
        ...attribution,
      };
      if (transactionId) payload.transaction_id = transactionId;

      if (orderRef) window.fbq("track", "Purchase", payload, { eventID: `purchase_${orderRef}` });
      else window.fbq("track", "Purchase", payload);
    };

    firePurchase();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [orderRef, product, contentName, transactionId, value, currency]);

  return null;
}
