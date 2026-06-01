# IREM Performance Notes — 2026-05-26

## Goal

- Reduce mobile load cost for the IREM landing without changing hero structure and without removing program GIF media.

## Findings

- Mobile Lighthouse bottleneck is network payload, not server response or main-thread JS.
- Largest media offenders:
  - `img/L 4.png` in hero
  - `img/IREMG_1.gif` through `img/IREMG_7.gif` in the program section
- `index.html` also loaded Google Fonts for `Open Sans` even though the landing already ships local font files.

## Applied Changes

- Added `webp` hero asset:
  - `img/L4.webp`
- Added animated `webp` program assets:
  - `img/IREMG_1.webp` … `img/IREMG_7.webp`
- Converted referenced landing PNG assets to `webp`, including:
  - `img/L 3.webp`
  - problem/program/support/footer/social/payment icons used by `index.html`
- Switched markup to `picture` with `webp` preferred and original `png/gif` as fallback.
- Kept GIF fallback in place; GIFs were not removed from the runtime contract.
- Removed external Google Fonts request from `index.html`.
- Replaced local TTF delivery for `Formular` with subsetted `woff2`.
- Removed dead `OpenSans` local `@font-face` entries that were not used by the IREM runtime.
- Added `font-display: swap` to local `@font-face` declarations.

## Expected Effect

- Major reduction of first-screen image transfer.
- Major reduction of program GIF transfer on browsers that support animated `webp`.
- One fewer external font request chain.

## Measured Compression

- `L 4.png` → `L4.webp`: `1460333` → `99380` bytes (`-93.2%`)
- `IREMG_1.gif` … `IREMG_7.gif` + hero image total:
  - `16425949` → `2495996` bytes (`-84.8%`)
- Active `Formular` font set:
  - `485120` bytes of TTF → `69296` bytes of subsetted `woff2` (`-85.7%`)

## Follow-Up

- Convert local TTF fonts to `woff2`.
- Consider `poster + click-to-play` or deferred animation for GIF-equivalent media if more savings are needed.
- Audit other large legacy PNG/JPG assets below the fold.
