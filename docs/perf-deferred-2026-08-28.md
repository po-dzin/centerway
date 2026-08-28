# Deferred after the 2026-08-28 media and performance pass

Status: open. Everything here was found, measured or reasoned about during the
pass recorded in `docs/media-weight-2026-08-28.md`, and deliberately **not**
done — because it needs a decision that is not a performance decision, or
because the measurement did not support it.

Nothing here is blocking. The wins that were unambiguous are shipped.

## Waiting on a migration being run

**1. Delete the 40 original PNG/JPEG plates under `public/cw/**` (~62 MB).**
The WebP re-encode kept them, and it had to: `lms_courses.cover` and
`lms_lessons.blocks` still name the old paths in the database, and
`lms_course_revisions` is append-only and will name them forever.

- Run `docs/migration/sql/2026-08-28_static_artwork_webp.sql` first. It ends
  with a verification `SELECT` that should return no rows.
- Then the originals can go — about 62 MB off every deployment.
- The cost, stated: historical course versions will render a broken image where
  a picture used to be. If that matters, the 62 MB is the price of an honest
  history, and this item should be closed as "won't do" rather than left open.

**2. The media ledger and the sweeper are code without a schema.**
`docs/migration/sql/2026-08-28_lms_media_ledger.sql` has not been run. Until it
is, `npm run media:sweep` fails with a clear message and every upload works
exactly as before — the route's ledger insert is the only thing that would
error, and it is written to fail the request rather than leave stray bytes, so
**run the migration before the next author uploads an image**.

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
