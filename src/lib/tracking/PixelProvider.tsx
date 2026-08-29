"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { META_PIXEL_ID } from "./pixelId";

/**
 * The Meta Pixel on the platform.
 *
 * It was written months ago and mounted nowhere, which is why every purchase
 * that returned to a platform page had a server-side Purchase from the WayForPay
 * webhook and no browser-side partner to deduplicate against. That was tolerable
 * only while the payment always returned to a funnel host; it stops being
 * tolerable the moment /pay/thanks is the destination.
 *
 * TWO THINGS IT MUST DO THE SAME WAY THE LANDINGS DO, or the two surfaces
 * disagree about the same visitor:
 *
 * 1. **Staff opt-out.** `?cw_staff=1` sets a durable flag, `?cw_staff=0` clears
 *    it, and while it is set the real SDK is never loaded and `fbq` is a no-op.
 *    Without this every QA payment — and the checkout QA runs on real
 *    transactions — becomes a real conversion in Meta. Same cookie the server
 *    reads in /api/events and /api/pay/start.
 * 2. **One init, PageView per route.** The pixel initialises once; a client-side
 *    navigation sends PageView and nothing else. Re-initialising per route was
 *    what the earlier draft did, and it re-sends the advanced-matching payload
 *    on every step through the cabinet.
 *
 * Mirrors src/landing-static/shared/js/landing-pixel.js. The two cannot be one
 * file — the landings are static HTML that never loads the app bundle — so the
 * contract is stated in both and the pixel id has a single source (./pixelId).
 *
 * ─── Why the SDK is loaded late, and why the STUB is not (2026-08-28) ───────
 *
 * Measured on a production build: `fbevents.js` and its config are 224 KB —
 * about a third of every page's bytes, and the largest single thing on most of
 * them. It was on `afterInteractive`, which is after hydration but still inside
 * the load, competing with the application's own JavaScript for bandwidth and
 * main thread.
 *
 * Moving the WHOLE thing to `lazyOnload` would have been one word and a real
 * bug: `window.fbq` would then not exist until the load event, and a Purchase
 * fired before that — on a thanks page that renders and reports immediately —
 * would go to `window.fbq?.(…)`, find nothing, and vanish. The event this
 * entire file exists for.
 *
 * So the two halves are split along the line Meta's own snippet already draws.
 * The stub is installed synchronously and QUEUES every call (`n.queue.push`);
 * the SDK is fetched at idle, or at the first interaction if idle never comes,
 * and drains that queue when it arrives. Nothing is lost, and the 224 KB is out
 * of the critical path.
 */

const STAFF_EVENT = "cw:staff-flag";

/** Pure read. Called during render, so it must not write anything. */
function readStaffFlag(): boolean {
  try {
    if (localStorage.getItem("cw_staff") === "1") return true;
  } catch {
    /* Private mode: the cookie needs no storage and is the fallback. */
  }
  return /(?:^|;\s*)cw_staff=1(?:;|$)/.test(document.cookie || "");
}

/** Applies `?cw_staff=1|0`. The write half, kept out of render. */
function persistStaffFlagFromUrl(search: string): void {
  let param: string | null = null;
  try {
    param = new URLSearchParams(search).get("cw_staff");
  } catch {
    return;
  }
  if (param !== "1" && param !== "0") return;

  const durable = 10 * 365 * 24 * 60 * 60;
  try {
    if (param === "1") localStorage.setItem("cw_staff", "1");
    else localStorage.removeItem("cw_staff");
  } catch {
    /* Cookie alone is enough — it is the copy the server reads anyway. */
  }
  document.cookie =
    param === "1"
      ? `cw_staff=1; path=/; max-age=${durable}; SameSite=Lax`
      : "cw_staff=; path=/; max-age=0; SameSite=Lax";

  window.dispatchEvent(new Event(STAFF_EVENT));
}

function subscribeToStaffFlag(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STAFF_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STAFF_EVENT, onChange);
  };
}

export function PixelProvider({ pixelId = META_PIXEL_ID }: { pixelId?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /* The server snapshot is `true` — treat an unknown reader as staff. That way
     the SDK is never in the HTML, and the one frame before hydration cannot
     load a pixel for someone who opted out. */
  const staff = useSyncExternalStore(subscribeToStaffFlag, readStaffFlag, () => true);
  const initialised = useRef(false);

  useEffect(() => {
    persistStaffFlagFromUrl(window.location.search);
  }, [searchParams]);

  useEffect(() => {
    /**
     * Reads the flag ITSELF rather than trusting `staff`, and that is not
     * belt-and-braces — it is the fix for a real failure.
     *
     * `useSyncExternalStore` hands the SERVER snapshot to the hydration render,
     * so the first commit always sees `staff === true` and this effect runs
     * once with it. Installing the no-op there poisoned the pixel for
     * everybody: the snippet that renders a beat later opens with
     * `if (f.fbq) return;`, found the stub already sitting on `window`, and
     * never initialised. Purchase then "fired" into a function that does
     * nothing — the single event this whole page exists for.
     */
    if (!readStaffFlag()) return;
    /* A no-op, so every downstream fbq(...) — Purchase on the thanks page
       included — does nothing instead of throwing. */
    if (!window.fbq) window.fbq = () => {};
  }, [staff]);

  useEffect(() => {
    if (staff) return;
    // The inline script does the first PageView; this covers the client-side
    // navigations after it.
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname, searchParams, staff]);

  if (staff || !pixelId) return null;

  return (
    <Script
      id="cw-meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];
var load=function(){if(f.__cwPixelSdk)return;f.__cwPixelSdk=1;
t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)};
// Idle first, with a ceiling: an idle callback that never fires on a busy page
// would hold the queue forever. And on ANY interaction, immediately — a click
// that is about to become a conversion must not wait for a quiet moment.
if(f.requestIdleCallback)f.requestIdleCallback(load,{timeout:4000});else f.setTimeout(load,2500);
['pointerdown','keydown','touchstart'].forEach(function(name){
b.addEventListener(name,load,{once:!0,passive:!0})});
}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
(function(){
  var ud = {};
  try {
    var stored = JSON.parse(localStorage.getItem('cw_user') || '{}');
    if (stored.em) ud.em = stored.em;
    if (stored.ph) ud.ph = stored.ph;
  } catch(e) {}
  fbq('init', ${JSON.stringify(pixelId)}, ud);
  fbq('track', 'PageView');
})();
`,
      }}
    />
  );
}
