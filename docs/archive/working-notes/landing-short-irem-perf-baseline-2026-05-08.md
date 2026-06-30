# Landing Perf Baseline (`short` / `irem`) — 2026-05-08

Local operational note for the first perf-hardening wave on `short`, with the same gate shape prepared for `irem`.

## Baseline

Mobile Lighthouse snapshot for `https://reboot.centerway.net.ua` before this wave:

- performance volatile between runs, observed range: `53` to `79`
- `LCP`: up to `11.2s` in the worst run, `3.6s` in the better full run
- `Speed Index`: `6.7s` to `10.4s`
- `TBT`: `120ms` to `310ms`
- `CLS`: `0`
- total payload: about `6.6MB`
- image transfer: about `4.1MB`
- third-party transfer: about `2.56MB`

Top waste drivers:

- oversized review proof image `feedback_short_tg.jpg`
- oversized lesson preview image `Short_1sec.png`
- eager YouTube embeds in hero and proof
- eager Facebook Pixel and Clarity loading
- render-blocking font/CSS chain

## First-Wave Budgets

These budgets are the acceptance target for the landing hardening path and should be reused for `irem`.

- above-the-fold media budget: `<= 350KB`
- total image bytes on first load: `<= 1.5MB`
- third-party scripts before interaction: `0`
- third-party embeds before interaction: `0`
- externally loaded font families on the landing shell: `<= 1`
- local font files referenced by the landing shell: keep existing surface, do not add new ones in this wave

## Implemented Wave Focus

- replace the heaviest `short` proof/program/icon images with smaller webp derivatives
- move YouTube embeds to click-to-load
- defer Facebook Pixel, Google Ads bootstrap, and Clarity network fetch until load/interaction
- add missing metadata and accessible labels/dimensions that were directly affecting audits

## Follow-up Gate

After this wave:

- rerun mobile Lighthouse on `short`
- run `npm run smoke:landing:short-irem`
- run `SMOKE_LANDING_ENTRY=next npm run smoke:landing:short-irem`
- if `short` meets targets or shows clear improvement, apply the same sequence to `irem`

## Wave 2 Result (`next` shell hardening)

Local production Lighthouse snapshot for `http://localhost:8012/reboot` after shell/font/third-party tuning:

- performance: `74`
- accessibility: `94`
- best practices: `100`
- SEO: `100`
- `FCP`: `2.7s`
- `LCP`: `4.8s`
- `Speed Index`: `5.5s`
- `TBT`: `80ms`
- `TTI`: `4.9s`
- `CLS`: `0`
- total payload: about `595KB`
- total requests: `40`
- third-party requests in audit window: `1`
- third-party transfer in audit window: about `10.6KB`

What changed in this wave:

- `reboot` and `irem` entry routes are now statically prerendered instead of forced dynamic
- managed landing shell no longer loads `fonts.css`, which removed five large `Formular` TTF files from the critical path
- Facebook Pixel, Google Ads bootstrap, and Clarity now wait for interaction/scroll or a long fallback timeout instead of loading during the initial render window
- critical hero CSS stays inline, while the rest of the shell remains managed by the landing asset chain

Remaining bottleneck after wave 2:

- render-blocking stylesheet chain is still the main LCP drag:
  - `/shared/css/landing.bridge.css`
  - `/short/css/short.product.css`
  - `/short/css/short.product.responsive.css`
  - global app stylesheet chunk
- remaining font transfer is now mostly global Next app fonts from the root layout, not landing-local fonts

Recommended next gate before mirroring the same shell policy to `irem`:

- keep the current shell/font policy for `irem`
- evaluate whether landing routes should opt out of global root font loading
- reduce or restructure the blocking CSS chain only if visual parity can be preserved without FOUC

## Wave 3 Result (deferred landing CSS)

Local production Lighthouse snapshot for `http://localhost:8013/reboot` after switching landing stylesheets to deferred `preload -> stylesheet` loading:

- performance: `71`
- accessibility: `94`
- best practices: `100`
- SEO: `100`
- `FCP`: `2.7s`
- `LCP`: `5.1s`
- `Speed Index`: `5.3s`
- `TBT`: `160ms`
- `TTI`: `5.2s`
- `CLS`: `0.01`
- total payload: about `669KB`
- total requests: `42`

Important interpretation:

- the score moved slightly down versus the previous run, but the landing-owned render-blocking chain was effectively removed
- Lighthouse now reports only one blocking stylesheet, the global Next app CSS chunk
- this means the remaining bottleneck is no longer the managed landing shell stylesheet stack; it is the shared app shell layer

Current decision:

- keep deferred landing stylesheet loading in place, because it removes landing-local blocking without breaking smoke coverage
- treat further gains as a separate architectural step:
  - isolate landing routes from global app font loading
  - reduce the global app CSS that still ships to landing entries

## Wave 4 Result (disable root font preload)

Local production Lighthouse snapshot for `http://localhost:8014/reboot` after disabling `next/font` preload in the root app layout:

- performance: `80`
- accessibility: `94`
- best practices: `100`
- SEO: `100`
- `FCP`: `2.7s`
- `LCP`: `3.8s`
- `Speed Index`: `4.6s`
- `TBT`: `140ms`
- `TTI`: `4.0s`
- `CLS`: `0.01`
- total payload: about `521KB`
- total requests: `32`
- font requests in audit window: `0`

Interpretation:

- the landing route no longer pays for global `Manrope` / `Cormorant Garamond` / `IBM Plex Mono` downloads during the audited initial window
- the remaining blocking resource is the shared app CSS chunk, not landing-local CSS or fonts
- this is the first wave where the route reaches the planned `TBT <= 150ms` target and gets close to the `Speed Index <= 4.0s` target

Current next-step boundary:

- mirror the same shell policy to `irem` through the already shared implementation
- if more gains are required, the next target is shrinking or isolating the global app CSS chunk that still lands on `/reboot`
