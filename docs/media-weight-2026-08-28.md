# Media weight — what an image costs, and what it costs now

Status: implemented 2026-08-28. What was deliberately left, and why, is in
`docs/perf-deferred-2026-08-28.md`.

## Contract

- Surface: the builder's image fields, the learner's lesson and shelf, the
  public catalogue and offer heroes.
- Semantic role: unchanged. This is not a new capability; it is the same
  pictures at a tenth of the weight.
- User question (author): *can I just use the photo I have?*
  User question (visitor): *why is this page still loading?*
- Token source: none — no visual token, recipe or layout was touched.
- Content source: `course-media` bucket, `public/cw/**`.
- Route boundary: unchanged.

## The measurement that started it

Storage was never the problem. At the platform's real authoring rate the bucket
grows by tens of megabytes a month, and a gigabyte is years away.

What was the problem is that nothing between an author's camera roll and a
visitor's phone made the file smaller.

- `/api/lms/authoring/media` stored the bytes it was handed. Its own comment
  said so: *"No resizing, no format conversion… the size ceiling is the crude
  version of all three."* A cover was up to 5 MB of 4000px JPEG.
- Every renderer is a plain `<img>` — deliberately, because an author may paste
  any host and `next/image` would need each one configured. So the 4000px
  original was what a 340px card downloaded.
- The shipped artwork was worse than the uploads: 40 PNG/JPEG plates under
  `public/cw/platform/**` and `public/cw/courses/**`, **62.8 MB**, several
  landing heroes at 2.8 MB each.

A catalogue screen of a dozen covers was on the order of 24 MB. Supabase's
free egress allowance is 5 GB a month — about two hundred such screens.

## What was built

### 1. A pipeline where there was a ceiling

`src/lib/lms/mediaPipeline.ts`, called by the upload route.

- **In:** up to 20 MB (was 5). A phone photograph is routinely over five, and
  "your picture is too big" is a sentence the product no longer needs to say.
- **Out:** WebP q80, longest edge 1600, plus a 640 rendition when the source is
  wide enough to warrant one. EXIF orientation is applied and the rest of the
  metadata — including GPS — is dropped, which was never true before.
- **Animation passes through untouched.** Re-encoding an animated GIF means
  choosing a codec and risking a lost frame; it keeps the old 5 MB ceiling,
  which the bucket enforces anyway.
- **Server side, not in the browser.** A canvas would save the upload itself but
  would put "what may be stored" in two places. Same reasoning that keeps the
  bucket without a write policy: the route already holds the authority.

Measured on the repository's own plates: **2.8 MB → 163 KB**, 2.4 MB → 147 KB.
Roughly a fifteenth, invisible at the sizes anything is drawn.

### 2. A path shape that renderers can read

One upload is now a folder, not a file:

```
courses/<course-id>/<uuid>/1600.webp
courses/<course-id>/<uuid>/640.webp
```

`src/lib/lms/media.ts` reads that convention back out of a bare URL, which is
all a renderer has by the time a card draws. An address either matches the
shape — our bucket, our folder — or it gets no `srcSet`, which is the right
answer for a pasted link and for the flat `<uuid>.webp` files written before
today.

Applied at: the learner's shelf, lesson figures, the builder's grid, block
previews, the image field's own preview, and the public offer hero. All of them
also gained `loading="lazy"` / `decoding="async"` where they lacked it.

### 3. The shipped artwork, re-encoded

`scripts/img/webp.mjs` — a one-shot migration, not a build step, because these
are versioned assets named from code, from data files and from database rows.

```
40 files: 62.8 MB → 5.4 MB (11.6× smaller)
```

References in `src/lib/platform/content.ts`, `src/lib/platform/tests.ts` and
`data/courses/*.json` now name the `.webp` sibling.

**The originals were kept.** Course covers and lesson blocks that live in
`lms_courses` / `lms_lessons` still name the old paths until the migration below
is run, and `lms_course_revisions` is append-only and will name them forever.
Deleting first would take the cover off a live course.

## The order of the remaining steps

1. Run `docs/migration/sql/2026-08-28_static_artwork_webp.sql` in the Supabase
   SQL editor. It moves `lms_courses.cover` and `lms_lessons.blocks` onto the
   `.webp` paths and ends with a verification `SELECT` that should return no
   rows.
2. Only then delete the 40 originals from `public/cw/platform/**` and
   `public/cw/courses/**` — about 62 MB off the deployment. Revision snapshots
   will render a broken image for historical versions after that; if that
   matters, the originals stay, and 62 MB of deployment is the price of an
   honest history.

## What was deliberately not done

- **`src/landing-static/**` (171 files, 22 MB)** — the funnel landings. Average
  130 KB, no single offender, and their references sit inside static HTML that
  the funnel hosts serve directly. Worth a pass, not this pass.
- **`public/cw/brand/**`** — manifest icons must be PNG and social crawlers read
  WebP unevenly. Small, and not worth the risk.
- **`PlatformOfferCard`'s cover** is a CSS `url()` custom property, so it cannot
  take a `srcSet`. `image-set(url(…/640.webp) 1x, url(…/1600.webp) 2x)` would
  work and is the obvious next step; it was left alone because it is a public
  landing surface and the re-encode already took the bytes down elevenfold.
(The orphan sweeper that used to be on this list was built in the same pass —
see below.)

## 4. The ledger and the sweeper

`docs/migration/sql/2026-08-28_lms_media_ledger.sql` — one table and two
functions, answering two questions that are easy to mistake for one:

- **How much does this course occupy?** Asked on a request path, for a quota.
  `lms_media_assets` gets a row per upload, so the answer is a sum over an
  index rather than a paginated walk of the bucket. The route writes that row
  *before* it tells the author it worked, and a failed write removes the
  objects again — bytes that count against nobody's quota are exactly what the
  table exists to prevent.
- **What is no longer referenced?** Asked nightly, by `npm run media:sweep`.
  Deliberately **not** answered from the ledger: the ledger knows what this
  application believes it wrote, and a sweeper's job is to find what it does not
  believe in. Ground truth is `storage.objects`, via `lms_media_inventory()`.

`lms_referenced_media()` unions three sources — covers, lesson blocks, **and
version history**. The third is the one that matters: revisions exist so an
author can restore an old version, and a restored version whose images were
swept is a page of broken frames. So an image that was ever saved is kept
forever. What the sweep actually collects is what was never saved — uploaded,
then replaced before the author pressed save — and everything belonging to
deleted courses, whose revisions cascade away with them.

Three things keep it from being dangerous:

- a **seven-day grace period**, because an image uploaded and not yet saved is
  referenced by nothing and is indistinguishable from an orphan by any query;
- a **refusal to sweep everything**: an empty reference set against a full
  bucket is a broken query far more often than an empty product, and the run
  stops rather than guessing;
- the decision itself lives in `src/lib/lms/mediaSweep.ts`, pure and tested.
  The script is plumbing; the part that decides what may be deleted is not.

`npm run media:sweep` reports and changes nothing. `npm run media:sweep:apply`
removes, marks `swept_at` on the ledger row, and leaves the row — what an
account once stored is how its usage got where it is, and a deleted record
cannot explain that.

**Both migrations have to be run by hand** in the SQL editor, in either order.
The ledger one ends with a read-only look at what the first sweep would collect.

## 5. The second pass: measured, not guessed

The first four sections fixed weight by reasoning about it. This one starts
from a production build served locally and read in a browser, because the
biggest item turned out not to be an image at all.

**Home page, before: ~1.8 MB over 47 requests.**

| what | was | why it was that |
|---|---|---|
| six program-card backgrounds | ~1.0 MB | each card is ~370 CSS px wide and was drawing the full 1600px plate as a CSS background |
| Meta Pixel (`fbevents.js` + config) | 224 KB | `afterInteractive` — after hydration, but still inside the load |
| YouTube embed | a whole player | a bare `<iframe>` with no `loading` attribute, below the fold |
| icon sprite | 57 KB, late | discovered only when the parser reached the first `<use>` |
| the app's own JS | ~215 KB | fine, and not the problem |

**Home page, after: 581 KB.**

### The card is not a hero

`scripts/img/webp.mjs` grew a second pass writing a 960px copy of every plate
over 100 KB, and `PlatformOfferArtwork` grew a `card` field naming it. The card
uses `card ?? desktop`, so a plate with no small copy behaves exactly as before.

`card` is written out rather than derived by appending `-960` to `desktop`. A
derivation is a rule that holds until someone adds a plate small enough not to
get a copy, and then it is a 404 on a public landing that nobody wrote down.
Written out, it is a path like any other — and `npm run guard:assets` (new, and
in `ds:qa`) now checks every `/cw/**` and `/shared/**` path in `src` and `data`
against the filesystem. That guard would have caught a bad rename in section 3
too.

One card still draws its full plate: reset-day, whose cover comes from the
database rather than from `content.ts`. Covers uploaded by an author do get the
card copy — `mediaSources` knows their renditions — but a repository path
arriving through a database row has no sibling anyone can promise.

### Third-party scripts, moved out of the way

- **gtag** → `lazyOnload`. Free: the provider already pushes every event into
  `dataLayer` whether or not gtag.js has arrived, and gtag.js drains that array
  when it does. It now starts at the load event instead of competing with it.
- **Meta Pixel** → split. Moving the whole thing to `lazyOnload` would have been
  one word and a real bug: `window.fbq` would not exist until load, and a
  Purchase fired before that — on a thanks page that reports immediately — would
  find nothing and vanish. So the stub is installed synchronously and QUEUES
  every call, exactly as Meta's own snippet is built to do, and only the 224 KB
  SDK waits for `requestIdleCallback` (ceiling 4s) or the first interaction,
  whichever comes first. Nothing is lost; the bytes are out of the way.

### One attribute, and one idea that failed measurement

`loading="lazy"` on the home page's intro video — the hero's CTA scrolls *down*
to it, so it is below the fold by construction.

The icon sprite was also given a `<link rel="preload" as="image">`, on the
reasoning that the browser only learns it is needed when the parser reaches the
first `<use href="…#id">`. The network panel then showed `cw-icons.svg`
**fetched twice**: a preload with `as="image"` does not match the request an
external `<use>` reference makes, so the preload was a second 57 KB download
rather than an earlier one. Removed. Whatever the right acceleration for an
external SVG sprite is, it is not that, and the honest state of it is in the
open list below.

### Still open

- `src/landing-static/**` — 171 images, 22 MB, average 130 KB. No single
  offender, and the references live in static HTML the funnel hosts serve
  directly. Worth its own pass.
- The intro video deserves a real facade (poster + play, iframe on click).
  `loading="lazy"` is most of the win for one attribute and no visual change;
  a facade is a new visual element on a public page and belongs in a design pass.
- The icon sprite is 70 symbols and 57 KB gzipped for the ~10 a page uses, and
  it is discovered late. Subsetting per surface, or inlining the handful the
  chrome needs and leaving the sprite for the rest, would fix both. Neither was
  attempted; the preload that looked like a free fix was not one.

## 6. The landings

The funnels are not the platform: five static HTML pages served through a route
handler, with their own CSS, their own runtime script, and 33 MB of images
accumulated across several redesigns.

**The first useful measurement was of the tree itself.** An audit that resolves
every path named by every landing HTML, CSS and JS file found that of those
33 MB, **9.2 MB is referenced at all** — and one file was a third of it:
`short/img/expert-photo.jpg`, 3.1 MB, **5152×7728**, a camera original uploaded
as-is and drawn in a box declared `width="360" height="480"`. On the page that
takes the money.

That is why `scripts/img/landing-webp.mjs` starts from the references rather
than from the directory. Converting the unreferenced 24 MB would have been work
and reference-rewriting for images no browser ever asks for.

```
16 images: 5421 KB → 805 KB (6.7× smaller)
   3121 KB →    54 KB   short/img/expert-photo.jpg
```

Long side capped at 1200, not the platform's 1600: a landing image sits in a box
the page has already sized. PNG sources go to **lossless** WebP — a PNG in this
tree is flat art with alpha (a payment-card strip), and quantising it puts mush
on the edge of a logo. The script is a dry run by default, because it rewrites
sales pages.

### Reboot landing, before → after

| | before | after |
|---|---|---|
| bytes before the load event | 1276 KB | **711 KB** |
| hero video `hero-bg.mp4` | fetched at ~300 ms | fetched at ~760 ms, after load |
| `expert-photo` | 3121 KB | 54 KB |

### The hero video needed markup, not an attribute

The clip is 566 KB and was arriving ahead of the page it sits behind. The
runtime already gated it on `prefers-reduced-motion` and save-data, and the
markup already said `preload="none"` — and the browser fetched it anyway.
`preload` is a hint; a `<source src>` in the document is an instruction.

So the source moved to `data-src` and the runtime attaches it at the moment it
decides to play, which also moved: from `DOMContentLoaded` to the first idle
after `load`. The poster is the clip's own first frame and is already on screen,
so nothing is missing while it waits.

One robustness fix came with it: a hidden tab refuses `play()`, and a visitor
who opened the page in a background tab would have come back to a frozen frame.
A rejected play now retries on the next `visibilitychange`.

### Two iframes, one video

The intro embed is in the markup **twice** — `.img.desk` and `.img.mob`, the
same YouTube video, one of them hidden by CSS at any given width. Both were
loading. All three iframes on the page now carry `loading="lazy"`, which takes
the visible one out of the initial load and skips the hidden one entirely.

*Verified as far as this environment allows:* the attribute is in place, but the
deferral itself could not be measured here — the preview pane runs with
`document.hidden === true`, and Chrome then treats every lazy element as being
in the viewport. The video and image numbers above are measured; this one is
standard behaviour taken on trust.

### Assets: an hour in the browser, a deployment at the edge

`serveStaticAsset` sent `public, max-age=3600` and nothing else, so the shared
cache expired hourly and a cold asset was a function invocation — confirmed
against production as `x-vercel-cache: MISS` on first request. It now sends
`s-maxage=31536000, stale-while-revalidate=86400` as well. A year at the edge is
safe precisely because these files are baked into the deployment: a changed
image is a new deployment, and a new deployment is a new cache. The browser half
stays at an hour on purpose — nothing here is fingerprinted.

### Dead weight found on the way

- **Google Fonts on the short landing** — two preconnects and a render-blocking
  third-party stylesheet for "Open Sans", which the page has not rendered since
  the design tokens landed: the family reads
  `var(--landing-font-family-base, var(--ds-font-family-base, "Open Sans", …))`,
  both tokens resolve to Formular, and a browser check confirmed no element uses
  it. The Next shell rebuilds the head and was already dropping those lines, so
  the live page never paid — but the file is the source of truth. Removed.
- **`guard:assets` now reads the landing tree too**, including relative paths,
  and skips references inside HTML comments (`way21` carries a commented-out
  video-testimonial card pointing at a poster that does not exist). This is
  the guard that protects a rewrite of sixteen image references across four
  sales pages from a typo.

### Still open on the landings

- 24 MB of unreferenced images in `src/landing-static/**`, including 2–3 MB
  animated GIFs and a second 3 MB copy of the author photo. Deleting them is a
  repository decision, not a performance one — nothing serves them.
- Seven render-blocking stylesheets on the short landing (~187 KB raw, ~35 KB
  brotli). Concatenating would save round trips but costs cross-landing cache
  reuse; not obviously worth it.
- The landing HTML itself is `max-age=0, must-revalidate` and never edge-cached.
  That looks deliberate — the document carries per-visitor offer state — and was
  left alone.
