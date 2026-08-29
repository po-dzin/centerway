# Deferred after the 2026-08-28 media and performance pass

Status: partly closed — the two migration items were verified applied on
2026-08-29 and need nothing. Everything here was found, measured or reasoned about during the
pass recorded in `docs/media-weight-2026-08-28.md`, and deliberately **not**
done — because it needs a decision that is not a performance decision, or
because the measurement did not support it.

Nothing here is blocking. The wins that were unambiguous are shipped.

## Waiting on a migration being run

**VERIFIED 2026-08-29 AGAINST PRODUCTION: nothing here is waiting any more.**
Both migrations named below were applied, and this section said otherwise for a
day — long enough for an audit to report a blocking schema gap that did not
exist. Checked over the session pooler (see the CLI route in
`scripts/db-stage-migration.mjs`); `supabase_migrations.schema_migrations` holds
every stamp through 20260829000000.

**1. Delete the 40 original PNG/JPEG plates under `public/cw/**` (~62 MB).**
The blocker is gone: `2026-08-28_static_artwork_webp.sql` HAS run. The
verification `SELECT` it ends with returns no rows — zero `lms_courses.cover`
and zero `lms_lessons.blocks` still name a `.png`/`.jpg` under `/cw/`.

- The 62 MB can now come off every deployment whenever someone wants it.
- The cost is unchanged and still a content decision, not a performance one:
  `lms_course_revisions` is append-only and names the old paths forever, so
  historical course versions will render a broken image. If that matters, this
  item closes as "won't do" rather than staying open.

**2. The media ledger.** `2026-08-28_lms_media_ledger.sql` HAS run.
`lms_media_assets`, the `lms_media_usage` view and all three functions
(`lms_media_asset_key`, `lms_media_inventory`, `lms_referenced_media`) exist,
and the backfill took: 2 assets / 1.74 MB, which matches what the bucket holds.
`npm run media:sweep` works and uploads write their ledger row. Nothing about
the next upload is at risk.

## Needs a decision that is not about performance

**3. 24 MB of unreferenced images in `src/landing-static/**`.**
An audit resolved every path named by every landing HTML, CSS and JS file: of
33 MB, 9.2 MB is referenced. The remainder includes 2–3 MB animated GIFs, a
second 3 MB copy of the author photo, and several generations of card art.

Not deleted, and not because of the bytes: an image can be referenced from
somewhere this repository cannot see — a social post, an email, a message
someone sent with a direct link. Deleting is a content decision. The list is
reproducible with `node scripts/img/landing-webp.mjs` (dry run prints what is
reachable).

**4. The home page's intro video deserves a facade.**
`loading="lazy"` is on it now, which is most of the win for one attribute and no
visual change. A poster-plus-play-button that swaps in the iframe on click would
remove the embed from the page entirely for visitors who never press play — but
that is a new visual element on a public page and belongs in a design pass with
the canon preflight, not in a byte-counting one.

**5. The icon sprite is 70 symbols and 57 KB gzipped for the ~10 a page uses,
and it is discovered late.**
Subsetting per surface, or inlining the handful the chrome needs and leaving the
sprite for the rest, would fix both. A `<link rel="preload" as="image">` looked
like the free fix and was **measured to be the opposite** — the network panel
showed `cw-icons.svg` fetched twice, because a preload with `as="image"` does not
match the request an external `<use href>` makes. Reverted. Whatever the right
answer is, it is not that.

## Measured and judged not worth it

**6. Seven render-blocking stylesheets on the short landing** (~187 KB raw,
~35 KB brotli). Concatenating would save six round trips on the first visit and
cost the cross-landing cache reuse that makes the second landing cheap. Under
HTTP/2 the round trips are multiplexed. Not obviously a win either way.

**7. The landing HTML is `max-age=0, must-revalidate` and never edge-cached.**
Every visitor invokes a function. That looks deliberate rather than accidental:
the document carries per-visitor offer state (`data-cw-offer-token`, price,
expiry), and caching it publicly would hand one visitor another's offer. Left
alone. If the offer state ever moves out of the document, this becomes the
single biggest TTFB win available on the funnels (measured 445 ms in production).

**8. Lesson photographs under `public/cw/courses/**` have no small renditions.**
They are drawn inside the reading column at roughly their own width, so a second
size would save little. `mediaSources` gives renditions to author uploads, which
is where the variety of sizes actually is.

## Could not be verified in this environment

**9. `loading="lazy"` on the three landing iframes.** The attribute is in place
and the reasoning is standard — including the case it fixes by accident, where
the same YouTube embed appears twice (`.img.desk` / `.img.mob`) and one copy is
always hidden. But the deferral itself could not be measured: the preview pane
runs with `document.hidden === true`, and Chrome then treats every lazy element
as being in the viewport. Worth one look in a real browser.

**10. The hero video's playback after the change.** The clip now loads on the
first idle after `load` (measured) and plays from there. That playback could not
be seen locally for the same reason — a hidden document refuses `play()`. The
retry-on-`visibilitychange` path exists precisely for that case, and it too is
unverified by eye.

## Not touched, and whose it is

`src/components/platform/layout/PlatformThemeControl.tsx` fails
`react-hooks/set-state-in-effect` and currently makes `npm run lint` red. It is
another session's in-progress file, created during this one, and none of this
pass touches it.
