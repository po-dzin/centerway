# Meta Pixel vs CAPI mismatch investigation (2026-06-29)

## Scope

- Surface: utility `thanks` pages for `short` and `irem`
- Event under investigation: `Purchase`
- Symptoms: Meta Events Manager shows far more `Purchase` events from Conversions API than from browser Pixel, so additional conversions and browser-side match data stay weak

## Main finding

The strongest structural mismatch was local, not in Meta reporting:

1. Browser `Purchase` is fired only on `thanks`:
   - `src/landing-static/short/thanks.html`
   - `src/landing-static/irem/thanks.html`
2. Server `Purchase` is fired from the payment webhook queue:
   - `src/app/api/wfp/webhook/route.ts`
   - `src/lib/jobs/worker.ts`
3. Shared Pixel loader deferred `fbevents.js` until interaction or a 12-second timeout:
   - `src/landing-static/shared/js/landing-pixel.js`
4. `thanks` auto-redirected to Telegram after 1.2 seconds:
   - `src/landing-static/short/thanks.html`
   - `src/landing-static/irem/thanks.html`

That meant the browser `fbq("track", "Purchase")` often entered the queue before the real Meta SDK loaded, and the page navigated away before the queued event could flush.

## Why CAPI stayed ahead

- CAPI `Purchase` is independent of the return page. Once WayForPay confirms payment, the webhook enqueues `meta:capi` and the worker sends `Purchase`.
- Browser `Purchase` requires the user to land on `thanks`, keep the same browser context, and remain on the page long enough for the Pixel SDK to actually load and send.
- Return URL only restores `order_ref`, `product`, `rrn`, `amount`, and `currency`. It does not restore `fbclid`, `fbp`, or `fbc`, so browser matching on `thanks` depends on same-browser persistence of cookies/local storage.

## Fix applied

1. `landing-pixel.js` now loads Meta Pixel immediately on utility-critical pages (`thanks`, `pay-failed`) instead of waiting for interaction/12s.
2. `thanks` auto-redirect timeout increased from `1200ms` to `2500ms` for both funnels to give the browser event time to flush.

## Residual risks

- If payment completes and the user returns in a different browser/app context, browser `Purchase` can still be lost while CAPI remains successful.
- If cookies/local storage are blocked, browser-side enrichment can still be weaker than server-side payloads.
- We still do not persist a first-party local event proving that the `thanks` page was opened, so future diagnosis still relies partly on Meta-side data.

## Recommended next diagnostic step

Add a local non-CAPI event for `thanks_page_viewed` or `purchase_client_signal` and expose it in admin analytics. That will let us separate:

- paid orders that never reached `thanks`;
- `thanks` opens where Pixel still failed to send;
- healthy browser + server pairs.
