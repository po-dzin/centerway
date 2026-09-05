# Offer page → landing, and the two proof rails on way21

Date: 2026-09-02. Local implementation note; nothing here is a durable
cross-route rule yet, so the RAverse canon is untouched.

## 1. «Дізнатися більше» at the foot of the outline

### Preflight

- `surface`: program page (`/programs/[slug]`).
- `semantic_role`: offer — a secondary route out of the offer, not a second CTA.
- `user_question`: «Це все, що ви можете розповісти? Де довга версія?»
- `token_source`: global app DS delivery tokens (`--cw-space-*`,
  `--cw-rule-fade-x`, `--cw-platform-muted`), button role from
  `PlatformButtons.module.css` (`secondary hug`).
- `content_source`: the surface registry, `src/lib/surfaces/catalog.ts`.
- `route_boundary`: platform route linking OUT to a funnel host.
- `selection_family`: `contour` — a link-shaped button in the secondary role;
  no ink stroke, no local paint.

### What was built

`src/lib/platform/offerLanding.ts` resolves a program slug to the product's own
funnel landing, from the registry rather than from a list. A product qualifies
only when its `platformRoute` is the page asking — which is what keeps legacy
aliases (`detox` → way21, `short` → reboot) and non-program hosts (`dosha`,
`herbs`, `consult`) out. Today that resolves for four addresses:

| `/programs/…` | landing |
| --- | --- |
| `way21` | `way21.centerway.net.ua` |
| `reset-day` | `resetday.centerway.net.ua` |
| `reboot` | `reboot.centerway.net.ua` |
| `irem` | `irem.centerway.net.ua` |

`OfferCurriculum` prints the link at the foot of «Програма курсу» — the point
where the page runs out of things to say to someone still deciding — and prints
nothing for an owner, who has no use for the page that sells what they own.

### Direction, against the isolation rule

The brand contract forbids a LANDING from linking out to the platform hub. This
is the opposite direction and stays inside one product: the Short Reboot offer
page points at the Short Reboot funnel, never at another author's.

## 2. Before/after and video rails in way21's proof section

### Preflight

- `surface`: product funnel (`src/landing-static/way21`).
- `semantic_role`: proof, with an attached boundary note.
- `user_question`: «Покажіть, що це справді працює у людей.»
- `token_source`: landing bridge tokens already in `shared/css/landing.css`
  (`--line`, `--surface`, `--chip`, `--r-md`, `--shadow-soft`, `--f-mono`).
- `content_source`: participant photographs and videos, published with consent.
- `route_boundary`: funnel route; no new outbound links.

### The empty-rail switch

Both rails ship complete and hidden by their own emptiness:

```css
[data-proof-optional]:not(:has(.ba-card,.vid-card)){display:none}
```

Publishing is therefore only «add a card» — there is no second place to
remember to unhide, and a rail can never render as an empty frame with arrows.

### Adding content

**Before/after.** `shared/img/feedback/ba-<name>-<yyyymm>-before.webp` and
`-after.webp`, 3:4, same framing and same light in both frames. Uncomment one
`.ba-card` per participant in the `ba-rail` track. The caption states the
interval («Оксана · 21 день»).

Deliberately two labelled photographs side by side, not a drag-wipe slider: a
wipe invites two frames taken weeks apart to be read as one continuous image.

**Video.** `data-video` takes a YouTube/Shorts URL, a **Facebook** video URL,
or a direct `.mp4`; `shared/js/proof.js` opens all three in the lightbox.
Poster 9:14 at `shared/img/feedback/video-<name>.webp` — optional, see below.

### Facebook is embeddable, with three differences from YouTube

1. **The frame is measured, not fluid.** YouTube takes an iframe and sizes
   itself; the Facebook video plugin renders at a width given in PIXELS in the
   URL. `frameBox()` measures the lightbox at click time and writes the width
   into both the URL and the element, clamped so a 9:16 video still fits a short
   viewport. `data-video-ratio` on the card overrides the default `9/16`.
2. **No autoplay, on purpose.** Facebook's plugin autoplays only MUTED, and a
   muted testimonial is a person moving their lips. The visitor presses play.
3. **No poster.** Facebook publishes no thumbnail a page may link to (its CDN
   URLs are signed and expire), so a Facebook card ships without an `<img>` and
   draws a paper tile with the play glyph instead — `.vid-card:not(:has(img))`.
   Export a frame by hand and add an `<img>` when there is one.

Two more things the embed depends on: the post must stay **Public** on Facebook
or the player renders empty for visitors, and the iframe is built on CLICK, so
no Facebook cookie is set for someone who never opens a video.

**The alternative worth considering.** With the participant's permission, save
the file and self-host it as `.mp4`: `proof.js` already plays direct files, a
real poster frame becomes possible, the proof survives the post being deleted or
made private, and nothing loads from Facebook at all.

Live on way21 now: one card, Наталія, from
`facebook.com/nataliia.vanieieva/videos/1417281108317980/` — verified public and
embeddable (the plugin returns a real player, HTTP 200).

### Claims

Both rails carry a `proof-note`: photos and videos are published with the
participants' consent, and the result is individual and not a medical promise.
That note is not decoration — a before/after rail is the highest-claim block on
the page, and the boundary has to travel with it.

### Still open

No before/after photographs and no videos exist in the repository yet, so both
rails currently render nothing on way21. Drop the assets in and uncomment the
example cards; the same pair of rails can then be lifted onto `reset-day`.


## What is actually live on way21 (2026-09-03)

**До і після — three cards.** Sources came from the owner's `Фото До-После`
Drive folder; the files were cropped to 2:3, converted to webp and given a baked
sRGB profile (untagged webp reads as P3 on iOS and picks up a different white
than the page — see the colour-seam note in the DS docs).

| card | files | note |
| --- | --- | --- |
| glued pair | `ba-2026-06-back.webp` | already one JPEG, side by side. Renders through `.ba-pair--single`: one cell, no `до`/`після` tags drawn over somebody else's composition, and the picture is CONTAINED in the same 4:3 frame the two-cell pair adds up to. Every card is the same size — 420×377 desktop, 330×329 phone — because a glued 1:1 photo given its own proportions made one card twice as tall as its neighbours and the rail lost its rhythm. |
| 2021 pair | `ba-2021-before/after.webp` | two photographs, both full-body. Which one is «до» was inferred from the pictures, not from the filenames — confirm. Renamed 2026-09-05: the files used to carry the participant's first name, which a filename publishes in the network tab no matter what the picture itself has been through. |
| studio | `ba-2026-06-studio-before/after.webp` | **the weak one.** «До» is a seated close-up at 296px wide, «після» is a full-body shot across a dance studio. Different distance, different framing, and the source is too small to fix by cropping. |

`.ba-shot img` is 2:3, not 3:4: every real photograph in this set is a standing
full-body portrait, and a 3:4 frame cut the legs off all of them.

**No captions, by the owner's call (2026-09-03).** Three cards each carrying a
variation of «фото до і після» under a picture of exactly that added nothing the
до/після pills were not already saying. The `.ba-card figcaption` rule stays in
the stylesheet — the component still supports a line — but no card carries one.

Same reasoning on the video cards: the YouTube one has a poster of the person
and needs no words. The Facebook one keeps a single word, «Facebook», because it
has no poster at all and would otherwise be a blank tile with a play button.

**Відеовідгуки — two cards.** The Facebook one (Наталія) and
`youtu.be/2cxLE4GUuRw`, the same video that sits in the proof section of the
`short` landing. Its poster is YouTube's own frame saved locally, so nothing is
requested from Google until somebody presses play.

`data-video-ratio` now applies to YouTube as well as Facebook. It has to: the
lightbox is 9:16 because this rail was built for vertical phone testimonials,
and this video is 16:9 — without the attribute it played as a stamp between two
black bars. Verified in the browser at 520×293.


## Dots

Both new rails carry pagination (`.car-dots` / `[data-car-dots]`, built by
proof.js). Two things about them:

- **One dot per scroll POSITION, not per card.** A desktop rail shows two cards
  and a phone one, and the last card can never be scrolled to the left edge — a
  dot per card would offer stops that move nothing. `stops()` is
  `cards - visible + 1`, recomputed on resize: the до/після rail draws 2 dots on
  a desktop and 3 on a phone, the video rail draws none on a desktop (both cards
  already fit) and 2 on a phone.
- **They sit after `.car`, not inside it.** `.car` is the positioning context
  for the two arrows, which centre on its height; a strip added inside would
  push them off the middle of the pictures.

The active dot is the card nearest the track's left edge, clamped to the last
dot, because past the final stop several cards share one resting place.

### Ten dots and a window (2026-09-03)

The strip never grows past ten. Past that the row of dots slides underneath a
fixed window, the active dot is held in the middle, and the row is clamped at
both ends so it never pulls away from its own edge. The dot sitting ON the
window's edge shrinks — but only where the row actually continues: clamped hard
against either end there is nothing further that way, and a shrunken dot there
would promise more of a strip that has run out. Never the active dot either: at
the ends the lit dot IS the one on the edge.

This applies to `.testimonial-carousel` too, which is the rail this was actually
asked for. Note the correction: the SCREENSHOT rail on way21 carries `hidden` —
it is dead markup, and the fifteen dots a reader can see belong to the
testimonial carousel above it. That component is shared by all five platform
landings; a landing with ten or fewer testimonials is unaffected, because a row
that fits is simply centred.

Measured on way21's fifteen: window `0..9` at the start with only the right dot
faded, `2..10` in the middle with both faded, `5..14` at the end with only the
left one.

One thing to know when testing this in a headless pane: a hidden document
suspends transitions, rAF and scroll events, so the dot row measures frozen at
its starting position. That is the harness, not the code — the preview file
carries a small shim that says so.

## Sizes, and the Facebook poster (2026-09-04)

**The cards were half the height of their neighbours.** A testimonial screenshot
slide is 886px tall on a desktop; the до/після card was 377 and the video card
411. So the pair cells went from 2:3 to **1:2** — every source here is a person
photographed head to foot, and a squat frame made the photographs read as the
rail's small print. Height then has to come from WIDTH, because two pictures
side by side cannot grow taller on their own without cropping into the people:
the card is now 560 rather than 420, and the video card 360 rather than 264.
Both land at 560 tall.

The source crops were regenerated at 1:2 from the originals rather than
re-cropped from the 2:3 files, so nothing was cut twice.

A phone has no width to spend — 92vw is two 172px cells — so there the cells go
taller instead (**2:5**), which crops a fifth off the sides of a centred
standing figure and buys back the height: 345×431 beside a 467 video and a 470
slide. The glued card follows the same arithmetic (two 2:5 cells side by side
is 4:5) so both kinds of card stay the same size.

**The Facebook card has a poster now**, which contradicts what this document
said two days ago. Facebook publishes no thumbnail URL a page may link to —
theirs are signed and expire — but the player renders one before play, and the
BYTES can be saved even though the address cannot be used. Opening the plugin
page and taking the frame it serves gives `video-fb-nataliia.webp`: the
participant in front of a CenterWay «Путь» banner, which is a better card than
any paper tile. `.vid-card:not(:has(img))` stays for the next posterless video.

One note for whoever tests this in the headless pane: it composites stale while
hidden, so a screenshot can come back blank or a scroll frame behind the DOM.
Measure through the DOM there; the numbers above are all measured, not seen.